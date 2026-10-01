// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// and src/view/layout/LayoutInternal.tsx (the measure-and-position cycle, moveable element
// handling and the observers that drive them), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// The engine reads the model's immutable state, keeps every piece of view state (rects, moveable
// elements, scroll, "rendered") keyed by node id, and changes the layout only through commands.
import type {
    BatchEntry,
    CommandError,
    CommandEvent,
    CommandResult,
} from "../commands/types";
import {
    DragDropManager,
    type DropZoneOptions,
    type OnExternalDrag,
} from "../dnd/DragDropManager";
import type { DragGroup } from "../dnd/DragGroup";
import { type EdgeBand, edgeBands, type Orientation } from "../geometry/dock";
import {
    contains,
    EMPTY_RECT,
    equalsWhenRounded,
    positionElement,
    type Rect,
    relativeTo,
    toRect,
} from "../geometry/rect";
import { type IKeyEventLike, matchesKey } from "../keyboard/keymap";
import { computeTabOverflow } from "../overflow/tabOverflow";
import {
    computePaths,
    getTabButtonId,
    getTabPanelId,
    windowPath,
} from "../paths";
import { PopoutManager, type PopoutOptions } from "../popout/PopoutManager";
import { type SizeRange, sizeRanges } from "../split/split";
import { resolveBorder, resolveLayout } from "../state/defaults";
import type { Model } from "../state/model";
import type { QueryArgs } from "../state/queries";
import type { AnyBorder, AnyRow, AnyState } from "../state/tree";
import { type AnyTypes, type DockableTypes, MAIN_LAYOUT } from "../state/types";
import type {
    EngineActionKey,
    EngineActionPayload,
    EngineActionResult,
    EngineGetKey,
    EngineGetPayload,
    EngineGetResult,
    EngineIsKey,
    EngineIsPayload,
} from "./verbs";

/** The kinds of element whose geometry the engine measures. */
export type MeasurableKind =
    | "row"
    | "tabset"
    | "tabstrip"
    | "tabsetcontent"
    | "tabbutton"
    | "borderheader"
    | "bordercontent";

/** Measures an element in viewport coordinates. Defaults to `getBoundingClientRect`. */
export type MeasureFunction = (element: HTMLElement) => Rect;

export interface LayoutEngineOptions<T extends DockableTypes = AnyTypes> {
    model: Model<T>;
    /** the layout this engine drives; defaults to the main layout */
    layoutId?: string | undefined;
    /** the main layout's engine, for the engines of popout windows */
    main?: LayoutEngine<T> | undefined;
    /** injectable element measurement (tests pass fixed rects) */
    measure?: MeasureFunction | undefined;
    /** true (default) to resize live while a splitter is dragged; false to preview and commit on release */
    realtimeResize?: boolean | undefined;
    /** seconds a view may take to animate the drop outline (exposed as data; default 0.3) */
    tabDragSpeed?: number | undefined;
    /** popout windows (main engine only) */
    popout?: PopoutOptions<T> | undefined;
    /** accepts foreign drags (files, links, other libraries) as new tabs (main engine only) */
    onExternalDrag?: OnExternalDrag<T> | undefined;
    /** layouts of other models this layout exchanges tabs with by drag and drop (main engine only) */
    dragGroup?: DragGroup | undefined;
    /**
     * What keeps this layout's DOM ids and window names apart from another layout's on the page
     * (their models may share node ids). Defaults to a page-unique `d<n>-`; an adapter may pass a
     * stable one (React's `useId`) so server and client agree. Main engine only.
     */
    idScope?: string | undefined;
}

/** Options of the engine an adapter may change on every render. */
export type LayoutEngineSettings<T extends DockableTypes = AnyTypes> = Pick<
    LayoutEngineOptions<T>,
    | "realtimeResize"
    | "tabDragSpeed"
    | "popout"
    | "onExternalDrag"
    | "dragGroup"
>;

/** How a panel hosts its content (a view option, not layout state). */
export interface MoveableOptions {
    /** the content scrolls inside its panel (default true); false clips it */
    scrollable?: boolean | undefined;
    /** the content is remounted when it moves to another window, so it is not parked (default false) */
    remountInWindow?: boolean | undefined;
}

/** Attribute that marks the element hosting a tab's content. */
export const MOVEABLE_ATTRIBUTE = "data-dockable-moveable";
/** Attribute that marks the hidden element parking moveables whose panel is gone. */
export const MOVEABLES_HOME_ATTRIBUTE = "data-dockable-moveables-home";
/**
 * Marks an element that belongs to an open overlay border (its wrapper, splitter, toolbar): a
 * press on it does not close the overlay.
 */
export const OVERLAY_ATTRIBUTE = "data-dockable-overlay";

const defaultMeasure: MeasureFunction = (element) =>
    element.getBoundingClientRect();

const NO_TABS: readonly string[] = Object.freeze([]);

/**
 * What only an adapter (React today; Angular and Vue next) calls on an engine: the render cycle,
 * element registration, moveable elements, measured geometry, overlay borders, and the drag and
 * popout machinery. An app never needs it: it uses `run`, `can`, `check`, `get` and `is`.
 *
 * The adapter's side of the cycle:
 * 1. call `prepare()` before rendering a layout (computes paths and size ranges);
 * 2. render the structure, registering elements with `registerMeasurable`, `registerTabPanel`
 *    and `registerSplitter`;
 * 3. run `engine.run("measure-and-position")` after every commit (a layout effect in React);
 * 4. re-render when the revision from `subscribe`/`getSnapshot` changes.
 */
export interface LayoutEngineAdapter<T extends DockableTypes = AnyTypes> {
    /** the model this engine draws */
    readonly model: Model<T>;
    /**
     * the main layout's engine (this one, for the main engine). It owns the popout windows, the
     * drag and drop state and the view state every engine of the model shares
     */
    readonly main: LayoutEngine<T>;
    /** the page-unique scope of this layout's DOM ids and window names */
    readonly idScope: string;
    /** the engine of the layout a node is in: a popout's, or the main one */
    engineOf(id: string): LayoutEngine<T>;
    /** the engine of a popout window's layout (it shares this main engine's view state) */
    createPopoutEngine(layoutId: string): LayoutEngine<T>;
    /** updates the options an adapter passes on every render */
    setOptions(options: LayoutEngineSettings<T>): void;

    /** calls `listener` when adapters should re-render; returns its remover */
    subscribe(listener: () => void): () => void;
    /** the render revision: a number that changes whenever adapters should re-render */
    getSnapshot(): number;
    /** asks adapters to re-render */
    redraw(): void;
    /**
     * prepares the layout for rendering: the `data-layout-path` of every node and the size ranges
     * rows and tabsets are rendered with. Call before rendering the layout
     */
    prepare(): void;
    /** the orientation of a row of this layout */
    rowOrientation(rowId: string): Orientation;

    /**
     * attaches the layout's root element (the containing block panels are positioned in) and
     * starts observing it and its window. Idempotent; another element detaches the previous one
     */
    attachRoot(element: HTMLElement): void;
    /** detaches the root element and releases every observer and listener */
    detachRoot(): void;
    /** detaches and forgets everything; the engine must not be used afterwards */
    dispose(): void;
    /** the attached root element */
    getLayoutRef(): HTMLElement | null;

    /** registers (or, with `null`, unregisters) an element whose geometry the engine measures */
    registerMeasurable(
        id: string,
        kind: MeasurableKind,
        element: HTMLElement | null,
    ): void;
    /**
     * registers (or unregisters) a tab container's tab list for tab overflow: when its tabs do
     * not fit, the engine hides the ones that do not (keeping the selected one) and reports them
     * through `getHiddenTabs`. `vertical` is the direction the tabs run
     */
    registerTabList(
        containerId: string,
        element: HTMLElement | null,
        vertical?: boolean,
    ): void;
    /**
     * registers (or unregisters) the overflow trigger of a tab container: the space it takes is
     * reserved in the strip
     */
    registerOverflowTrigger(
        containerId: string,
        element: HTMLElement | null,
    ): void;
    /** the ids of a container's tabs hidden by tab overflow (the same array until it changes) */
    getHiddenTabs(containerId: string): readonly string[];
    /** calls `listener` when a container's hidden tabs change; returns its remover */
    subscribeOverflow(listener: () => void): () => void;
    /** registers (or unregisters) the element a tab's content panel is positioned with */
    registerTabPanel(tabId: string, element: HTMLElement | null): void;
    /**
     * registers (or unregisters) a splitter element. Its thickness (its width while
     * `isHorizontal()`, its height otherwise) becomes the splitter size
     */
    registerSplitter(
        element: HTMLElement,
        isHorizontal: () => boolean,
        register?: boolean,
    ): void;
    /**
     * makes `element` a drop zone for this model's drags: a drop the zone accepts calls
     * `options.onDrop` instead of moving anything. Returns its remover
     */
    registerDropZone(element: Element, options: DropZoneOptions<T>): () => void;
    /** the registered elements (tests and debugging) */
    getRegistrations(): {
        measurables: ReadonlyMap<
            string,
            { kind: MeasurableKind; id: string; element: HTMLElement }
        >;
        tabPanels: ReadonlyMap<string, HTMLElement>;
        splitters: ReadonlyMap<HTMLElement, () => boolean>;
    };

    /** a measured rect of a node of this layout, relative to the layout root */
    rect(kind: MeasurableKind, id: string): Rect | undefined;
    /** the content area a tab's panel is positioned over (its tabset's, or its border's) */
    contentRect(containerId: string): Rect | undefined;
    /** measures every registered element; returns true on change */
    syncLayoutMetrics(): boolean;
    /**
     * positions the tab panels over their container's content area and shows only the visible
     * ones (structural style only)
     */
    positionTabPanels(): void;
    /** re-measures the layout root; a changed size re-renders */
    updateRect(): void;
    /** an element's rect relative to the layout root */
    rectInLayout(element: HTMLElement): Rect;
    /** the layout root's rect in viewport coordinates (cached for a measure pass) */
    getDomRect(): Rect;
    /** the layout root's rect in viewport coordinates, measured now */
    getFreshDomRect(): Rect;
    /** a layout-relative rect in screen coordinates (for opening popout windows) */
    getScreenRect(rect: Rect): Rect;
    /**
     * the edge drop bands of this layout's root row, relative to the layout root: where a drop
     * docks to an edge, and where an edge indicator goes. Empty when edge docking is off
     */
    edgeBands(): EdgeBand[];

    /**
     * the element that hosts a tab's content (`<div data-dockable-moveable>`), created on first
     * use and kept for as long as the tab exists, so moving a tab never remounts its content
     */
    getMoveableElement(tabId: string): HTMLElement;
    /**
     * moves the tab's moveable element into `panel`. The same element is re-parented, never
     * cloned, so content state survives moves between panels and documents
     */
    attachMoveable(
        tabId: string,
        panel: HTMLElement,
        options?: MoveableOptions,
    ): void;
    /**
     * parks the tab's moveable element in the hidden moveables home when its panel goes away, so
     * its content is never destroyed by unmounting a panel
     */
    releaseMoveable(
        tabId: string,
        panel?: HTMLElement,
        options?: MoveableOptions,
    ): void;
    /** hands a tab's moveable element over (a drag group transfer); undefined if none */
    takeMoveable(tabId: string): HTMLElement | undefined;
    /** adopts another model's moveable element for a tab (a drag group transfer) */
    adoptMoveable(tabId: string, element: HTMLElement | undefined): void;
    /** the hidden element moveables are parked in (main layout only) */
    getMoveablesHome(): HTMLElement | null;
    /**
     * whether a tab's content should be rendered: once rendered it stays rendered; before that,
     * when its content area has a size and it is selected (or `renderOnDemand` is off)
     */
    shouldRender(tabId: string, renderOnDemand?: boolean): boolean;

    /**
     * call on every `pointerdown` of the document (capture phase): a press in the main layout's
     * area outside an open overlay panel closes that panel. Returns true when a panel closed
     */
    handleOverlayPointerDown(event: {
        target: EventTarget | null;
        clientX: number;
        clientY: number;
    }): boolean;
    /**
     * call on every `keydown` with the close key: with focus in an open overlay panel or on its
     * tab button, the key closes the panel. Returns true (and prevents the default) when it did
     */
    handleOverlayKeyDown(
        event: IKeyEventLike & { preventDefault(): void },
        key: string | undefined,
    ): boolean;

    /** whether splitters resize live (else they preview and commit on release) */
    isRealtimeResize(): boolean;
    /** marks a splitter drag of the model as started or ended */
    setSplitterDragging(dragging: boolean): void;
    /** the drag-and-drop state machine of this layout */
    getDragDropManager(): DragDropManager<T>;
    /** the drag group this layout exchanges tabs in (the main engine's), if any */
    getDragGroup(): DragGroup | undefined;
    /** the handler that accepts foreign drags (set on the main engine) */
    getOnExternalDrag(): OnExternalDrag<T> | undefined;
    /** seconds a view may take to animate the drop outline */
    getTabDragSpeed(): number;
    /** the popout windows of the model (owned by the main engine) */
    getPopoutManager(): PopoutManager<T>;
}

function refused(message: string): { ok: false; error: CommandError } {
    return { ok: false, error: { code: "refused", message } };
}

function notFound(message: string): { ok: false; error: CommandError } {
    return { ok: false, error: { code: "not_found", message } };
}

/** The view state every engine of a model shares (owned by the main engine). */
class SharedView {
    readonly moveables = new Map<string, HTMLElement>();
    readonly scroll = new Map<string, { top: number; left: number }>();
    readonly rendered = new Set<string>();
    readonly splitters = new Map<HTMLElement, () => boolean>();
    readonly listeners = new Set<() => void>();
    moveablesHome: HTMLElement | null = null;
    /** each open window layout's number in its paths (`/sublayout<n>`), kept while it is open */
    readonly windowNumbers = new Map<string, number>();
    idScope = "";
    splitterSize = 8;
    splitterDragging = false;
    revision = 0;
}

let scopes = 0;

/** the element that hosts each moveable's scroll tracking, and the tab it currently hosts */
const scrollTracking = new WeakMap<
    HTMLElement,
    { tab: string; view: SharedView }
>();

/**
 * One layout on screen: the main layout's, or a popout window's (one engine per window). It
 * measures the elements an adapter registers, positions tab panels over their content area
 * (structural style only), owns the moveable elements that host tab content, and runs the drag
 * and drop and the popout windows. It never changes the model except through commands.
 *
 * An app uses its verbs, the same as the model's:
 *
 * - `run` performs a screen action (`engine.run("popout", { node })`); `can` answers whether it
 *   would succeed, `check` returns what it would return;
 * - `get` reads a view fact (`engine.get("tab-panel-id", { tab })`); `is` asks a yes/no question
 *   (`engine.is("popout-supported")`).
 *
 * Page-wide actions and questions work from any engine: an app never needs the main one.
 * Everything else is under `adapter`, for writing an adapter. Every verb is bound.
 */
export class LayoutEngine<T extends DockableTypes = AnyTypes> {
    /** the layout this engine draws: `MAIN_LAYOUT` (`"main"`) or a popout window's id */
    readonly layoutId: string;
    private readonly model: Model<T>;
    private readonly main: LayoutEngine<T>;
    private readonly shared: SharedView;
    private readonly measureElement: MeasureFunction;
    private realtimeResize: boolean;
    private tabDragSpeed: number;
    private onExternalDragHandler: OnExternalDrag<T> | undefined;
    private dragGroup: DragGroup | undefined;
    private leaveDragGroup: (() => void) | undefined;
    private readonly dragDropManager: DragDropManager<T>;
    private readonly popoutManager: PopoutManager<T> | undefined;

    private layoutRef: HTMLElement | null = null;
    private currentDocument: Document | undefined;
    private currentWindow: Window | undefined;
    private cachedLayoutDomRect: Rect | undefined;
    private reLayout = false;
    private lastRect: Rect = EMPTY_RECT;
    /** measured elements and their last rects, by `kind:id` */
    private readonly measurables = new Map<
        string,
        { kind: MeasurableKind; id: string; element: HTMLElement }
    >();
    private readonly rects = new Map<string, Rect>();
    private readonly tabPanels = new Map<string, HTMLElement>();
    private geometryResizeObserver: ResizeObserver | undefined;
    private readonly tabLists = new Map<
        string,
        { element: HTMLElement; vertical: boolean }
    >();
    private readonly overflowTriggers = new Map<string, HTMLElement>();
    private readonly naturalTabSizes = new Map<string, number>();
    private readonly triggerSpace = new Map<string, number>();
    private readonly hiddenTabs = new Map<string, readonly string[]>();
    private readonly overflowListeners = new Set<() => void>();
    private healFrame: number | undefined;
    private readonly teardown: (() => void)[] = [];
    // derived per state
    private pathsFor: AnyState | undefined;
    private paths = new Map<string, string>();
    private rangesKey = "";
    private ranges = new Map<string, SizeRange>();

    constructor(options: LayoutEngineOptions<T>) {
        this.model = options.model;
        this.layoutId = options.layoutId ?? MAIN_LAYOUT;
        this.main = options.main ?? this;
        this.shared = this.main === this ? new SharedView() : this.main.shared;
        if (this.main === this) {
            this.shared.idScope = options.idScope ?? `d${++scopes}-`;
        }
        // the verbs can be passed around detached: `const { run } = engine`
        this.run = this.run.bind(this);
        this.can = this.can.bind(this);
        this.check = this.check.bind(this);
        this.get = this.get.bind(this);
        this.is = this.is.bind(this);
        this.measureElement = options.measure ?? defaultMeasure;
        this.realtimeResize = options.realtimeResize ?? true;
        this.tabDragSpeed = options.tabDragSpeed ?? 0.3;
        this.onExternalDragHandler = options.onExternalDrag;
        this.dragDropManager = new DragDropManager<T>(this);
        this.setDragGroup(options.dragGroup);
        if (this.main === this) {
            this.popoutManager = new PopoutManager<T>(this);
            this.popoutManager.setOptions(options.popout ?? {});
        }
    }

    /** what only an adapter calls: see {@link LayoutEngineAdapter} */
    readonly adapter: LayoutEngineAdapter<T> = this.createAdapter();

    /** performs a screen action; never throws on bad input */
    run<K extends EngineActionKey>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>> {
        return this.act(action, payload[0], false) as CommandResult<
            EngineActionResult<K>
        >;
    }

    /** whether `run` would succeed now (nothing happens) */
    can<K extends EngineActionKey>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): boolean {
        return this.act(action, payload[0], true).ok;
    }

    /** what `run` would return (its value, or why it is refused), without doing anything */
    check<K extends EngineActionKey>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>> {
        return this.act(action, payload[0], true) as CommandResult<
            EngineActionResult<K>
        >;
    }

    /** reads a fact of this layout on screen */
    get<K extends EngineGetKey>(
        key: K,
        ...payload: QueryArgs<EngineGetPayload<K>>
    ): EngineGetResult<K> {
        const getter = Object.hasOwn(this.getters, key)
            ? (this.getters[key] as (payload: unknown) => unknown)
            : undefined;
        return getter?.(payload[0] ?? {}) as EngineGetResult<K>;
    }

    /** asks a yes/no question about this layout on screen */
    is<K extends EngineIsKey>(
        key: K,
        ...payload: QueryArgs<EngineIsPayload<K>>
    ): boolean {
        const question = Object.hasOwn(this.questions, key)
            ? (this.questions[key] as (payload: unknown) => boolean)
            : undefined;
        return question?.(payload[0] ?? {}) ?? false;
    }

    private act(
        action: string,
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const handler = Object.hasOwn(this.actions, action)
            ? (this.actions[action as EngineActionKey] as (
                  payload: unknown,
                  dryRun: boolean,
              ) => CommandResult<unknown>)
            : undefined;
        if (!handler) {
            return {
                ok: false,
                error: {
                    code: "unknown_command",
                    message: `unknown action "${action}"`,
                },
            };
        }
        return handler(payload ?? {}, dryRun);
    }

    private readonly actions: {
        [K in EngineActionKey]: (
            payload: EngineActionPayload<K>,
            dryRun: boolean,
        ) => CommandResult<EngineActionResult<K>>;
    } = {
        popout: ({ node }, dryRun) => this.popout(node, dryRun),
        "dock-back": ({ node }, dryRun) => this.dockBack(node, dryRun),
        "focus-tabset": ({ direction }, dryRun) =>
            this.focusAdjacentTabset(direction === "previous" ? -1 : 1, dryRun),
        "close-overlay-border": ({ border }, dryRun) =>
            this.closeOverlayBorder(border, dryRun),
        "measure-and-position": (_payload, dryRun) => {
            if (!dryRun) {
                this.sync();
            }
            return { ok: true, value: {} };
        },
    };

    private readonly getters: {
        [K in EngineGetKey]: (
            payload: EngineGetPayload<K>,
        ) => EngineGetResult<K>;
    } = {
        path: ({ node }) => this.path(node),
        "tab-button-id": ({ tab }) => this.tabButtonId(tab),
        "tab-panel-id": ({ tab }) => this.tabPanelId(tab),
        "size-limits": ({ node }) => this.minMax(node),
        "splitter-size": () => this.splitterSize(),
        "owner-document": () => this.getCurrentDocument(),
        "owner-window": () => this.getCurrentWindow(),
    };

    private readonly questions: {
        [K in EngineIsKey]: (payload: EngineIsPayload<K>) => boolean;
    } = {
        "popout-supported": () => this.isSupportsPopout(),
        "panel-visible": ({ tab }) => this.isPanelVisible(tab),
        "main-layout": () => this.isMainLayout(),
        "splitter-dragging": () => this.isSplitterDragging(),
    };

    private createAdapter(): LayoutEngineAdapter<T> {
        const engine = this;
        return {
            get model() {
                return engine.model;
            },
            get main() {
                return engine.main;
            },
            get idScope() {
                return engine.idScope;
            },
            engineOf: (id: string) => this.engineOf(id),
            createPopoutEngine: (layoutId: string) =>
                this.createPopoutEngine(layoutId),
            setOptions: (options: LayoutEngineSettings<T>) =>
                this.setOptions(options),
            subscribe: (listener: () => void) => this.subscribe(listener),
            getSnapshot: () => this.getSnapshot(),
            redraw: () => this.redraw(),
            prepare: () => this.prepare(),
            rowOrientation: (rowId: string) => this.rowOrientation(rowId),
            attachRoot: (element: HTMLElement) => this.attachRoot(element),
            detachRoot: () => this.detachRoot(),
            dispose: () => this.dispose(),
            getLayoutRef: () => this.getLayoutRef(),
            registerMeasurable: (
                id: string,
                kind: MeasurableKind,
                element: HTMLElement | null,
            ) => this.registerMeasurable(id, kind, element),
            registerTabList: (
                containerId: string,
                element: HTMLElement | null,
                vertical?: boolean,
            ) => this.registerTabList(containerId, element, vertical),
            registerOverflowTrigger: (
                containerId: string,
                element: HTMLElement | null,
            ) => this.registerOverflowTrigger(containerId, element),
            getHiddenTabs: (containerId: string) =>
                this.getHiddenTabs(containerId),
            subscribeOverflow: (listener: () => void) =>
                this.subscribeOverflow(listener),
            registerTabPanel: (tabId: string, element: HTMLElement | null) =>
                this.registerTabPanel(tabId, element),
            registerSplitter: (
                element: HTMLElement,
                isHorizontal: () => boolean,
                register?: boolean,
            ) => this.registerSplitter(element, isHorizontal, register),
            registerDropZone: (element: Element, options: DropZoneOptions<T>) =>
                this.registerDropZone(element, options),
            getRegistrations: () => this.getRegistrations(),
            rect: (kind: MeasurableKind, id: string) => this.rect(kind, id),
            contentRect: (containerId: string) => this.contentRect(containerId),
            syncLayoutMetrics: () => this.syncLayoutMetrics(),
            positionTabPanels: () => this.positionTabPanels(),
            updateRect: () => this.updateRect(),
            rectInLayout: (element: HTMLElement) => this.rectInLayout(element),
            getDomRect: () => this.getDomRect(),
            getFreshDomRect: () => this.getFreshDomRect(),
            getScreenRect: (rect: Rect) => this.getScreenRect(rect),
            edgeBands: () => this.edgeBands(),
            getMoveableElement: (tabId: string) =>
                this.getMoveableElement(tabId),
            attachMoveable: (
                tabId: string,
                panel: HTMLElement,
                options?: MoveableOptions,
            ) => this.attachMoveable(tabId, panel, options),
            releaseMoveable: (
                tabId: string,
                panel?: HTMLElement,
                options?: MoveableOptions,
            ) => this.releaseMoveable(tabId, panel, options),
            takeMoveable: (tabId: string) => this.takeMoveable(tabId),
            adoptMoveable: (tabId: string, element: HTMLElement | undefined) =>
                this.adoptMoveable(tabId, element),
            getMoveablesHome: () => this.getMoveablesHome(),
            shouldRender: (tabId: string, renderOnDemand?: boolean) =>
                this.shouldRender(tabId, renderOnDemand),
            handleOverlayPointerDown: (event: {
                target: EventTarget | null;
                clientX: number;
                clientY: number;
            }) => this.handleOverlayPointerDown(event),
            handleOverlayKeyDown: (
                event: IKeyEventLike & { preventDefault(): void },
                key: string | undefined,
            ) => this.handleOverlayKeyDown(event, key),
            isRealtimeResize: () => this.isRealtimeResize(),
            setSplitterDragging: (dragging: boolean) =>
                this.setSplitterDragging(dragging),
            getDragDropManager: () => this.getDragDropManager(),
            getDragGroup: () => this.getDragGroup(),
            getOnExternalDrag: () => this.getOnExternalDrag(),
            getTabDragSpeed: () => this.getTabDragSpeed(),
            getPopoutManager: () => this.getPopoutManager(),
        };
    }

    /** the engine of a popout window's layout (it shares this main engine's view state) */
    private createPopoutEngine(layoutId: string): LayoutEngine<T> {
        return new LayoutEngine<T>({
            model: this.model,
            layoutId,
            main: this,
            measure: this.measureElement,
        });
    }

    // *********************************************************************************
    // Adapter contract
    // *********************************************************************************

    /** Updates the options an adapter passes on every render. */
    private setOptions(options: LayoutEngineSettings<T>) {
        this.setDragGroup(options.dragGroup);
        this.popoutManager?.setOptions(options.popout ?? {});
        this.realtimeResize = options.realtimeResize ?? true;
        this.tabDragSpeed = options.tabDragSpeed ?? 0.3;
        this.onExternalDragHandler = options.onExternalDrag;
    }

    /** Joins (or leaves) a drag group. Only the main engine joins: popouts share its model. */
    private setDragGroup(group: DragGroup | undefined) {
        if (this.main !== this || group === this.dragGroup) {
            return;
        }
        this.leaveDragGroup?.();
        this.dragGroup = group;
        this.leaveDragGroup = group?.join(
            this as unknown as LayoutEngine<AnyTypes>,
        );
    }

    /** The drag group this layout exchanges tabs in (the main engine's), if any. */
    private getDragGroup(): DragGroup | undefined {
        return this.main.dragGroup;
    }

    /** The handler that accepts foreign drags (set on the main engine). */
    private getOnExternalDrag(): OnExternalDrag<T> | undefined {
        return this.main.onExternalDragHandler;
    }

    /**
     * Makes `element` a drop zone for this model's drags: while a drag the zone accepts is over it,
     * the layouts show no outline, and a drop calls `options.onDrop` instead of moving anything.
     * Returns the function that unregisters it.
     */
    private registerDropZone(
        element: Element,
        options: DropZoneOptions<T>,
    ): () => void {
        return DragDropManager.registerDropZone(this.model, element, options);
    }

    /** Calls `listener` when adapters should re-render. Returns the unsubscribe function. */
    private readonly subscribe = (listener: () => void): (() => void) => {
        this.shared.listeners.add(listener);
        return () => {
            this.shared.listeners.delete(listener);
        };
    };

    /** The render revision: a number that changes whenever adapters should re-render. */
    private readonly getSnapshot = (): number => this.shared.revision;

    /**
     * Prepares the layout for rendering: the `data-layout-path` of every node and the size ranges
     * rows and tabsets are rendered with. Call before rendering the layout.
     */
    private prepare() {
        this.cachedLayoutDomRect = undefined;
        this.derived();
    }

    /**
     * A window layout's number in its paths: the lowest one free when it is first seen, then kept
     * while it is open, so closing one window never renames another's elements.
     */
    private windowNumber(state: AnyState, layoutId: string): number {
        const numbers = this.shared.windowNumbers;
        for (const id of [...numbers.keys()]) {
            if (!state.windows.some((w) => w.id === id)) {
                numbers.delete(id);
            }
        }
        let number = numbers.get(layoutId);
        if (number === undefined) {
            const used = new Set(numbers.values());
            number = 1;
            while (used.has(number)) {
                number++;
            }
            numbers.set(layoutId, number);
        }
        return number;
    }

    /** The DOM id of a tab's button in this layout (unique on the page, see `idScope`). */
    private tabButtonId(tabId: string): string {
        return getTabButtonId(tabId, this.shared.idScope);
    }

    /** The DOM id of a tab's panel in this layout (unique on the page, see `idScope`). */
    private tabPanelId(tabId: string): string {
        return getTabPanelId(tabId, this.shared.idScope);
    }

    /** the page-unique scope of this layout's DOM ids and window names */
    private get idScope(): string {
        return this.shared.idScope;
    }

    private derived() {
        const state = this.model.state as unknown as AnyState;
        const root = this.rootRow(state);
        if (!root) {
            return;
        }
        if (this.pathsFor !== state) {
            this.pathsFor = state;
            const prefix =
                this.layoutId === MAIN_LAYOUT
                    ? ""
                    : windowPath(this.windowNumber(state, this.layoutId));
            this.paths = computePaths(
                root,
                prefix,
                this.layoutId === MAIN_LAYOUT ? state.borders : [],
            );
        }
        const strips = new Map<string, number>();
        let key = `${this.shared.splitterSize}`;
        for (const [measured, rect] of this.rects) {
            if (measured.startsWith("tabstrip:")) {
                strips.set(measured.slice(9), rect.height);
                key += `|${measured}:${Math.round(rect.height)}`;
            }
        }
        const stateKey = `${key}#${this.revisionOf(state)}`;
        if (stateKey !== this.rangesKey) {
            this.rangesKey = stateKey;
            this.ranges = sizeRanges(
                state.defaults,
                root,
                resolveLayout(state.defaults).rootOrientation,
                this.shared.splitterSize,
                (id) => strips.get(id) ?? 0,
            );
        }
    }

    private readonly stateIds = new WeakMap<object, number>();
    private nextStateId = 0;
    private revisionOf(state: AnyState): number {
        let id = this.stateIds.get(state);
        if (id === undefined) {
            id = this.nextStateId++;
            this.stateIds.set(state, id);
        }
        return id;
    }

    private rootRow(state: AnyState): AnyRow | undefined {
        if (this.layoutId === MAIN_LAYOUT) {
            return state.root;
        }
        return state.windows.find((w) => w.id === this.layoutId)?.root;
    }

    /** The `data-layout-path` of a node of this layout (the root row's is the layout's prefix). */
    private path(id: string): string {
        this.derived();
        return this.paths.get(id) ?? "";
    }

    /** The size range of a row or tabset of this layout (its flex min/max). */
    private minMax(id: string): SizeRange {
        this.derived();
        return (
            this.ranges.get(id) ?? {
                minWidth: 0,
                minHeight: 0,
                maxWidth: 99999,
                maxHeight: 99999,
            }
        );
    }

    /** The orientation of a row of this layout. */
    private rowOrientation(rowId: string): Orientation {
        let orientation = resolveLayout(this.state().defaults).rootOrientation;
        for (
            let parent = this.model.get("parent", { node: rowId });
            parent !== undefined;
            parent = this.model.get("parent", { node: parent.id })
        ) {
            orientation =
                orientation === "horizontal" ? "vertical" : "horizontal";
        }
        return orientation;
    }

    /** The measured splitter thickness (shared by every layout of the model). */
    private splitterSize(): number {
        return this.shared.splitterSize;
    }

    private state(): AnyState {
        return this.model.state as unknown as AnyState;
    }

    /**
     * Attaches the layout's root element: the containing block the panels are positioned in.
     * Starts observing it and the window it lives in. Idempotent; attaching another element
     * detaches the previous one first.
     */
    private attachRoot(element: HTMLElement) {
        if (this.layoutRef === element && this.teardown.length > 0) {
            return;
        }
        this.detachRoot();
        this.layoutRef = element;
        const doc = element.ownerDocument;
        const win = doc.defaultView ?? undefined;
        this.currentDocument = doc;
        this.currentWindow = win;

        if (this.isMainLayout()) {
            // reuse a home left behind by a previous engine of the same root
            let home = Array.from(element.children).find((child) =>
                child.hasAttribute(MOVEABLES_HOME_ATTRIBUTE),
            ) as HTMLElement | undefined;
            if (!home) {
                home = doc.createElement("div");
                home.setAttribute(MOVEABLES_HOME_ATTRIBUTE, "");
                home.setAttribute("aria-hidden", "true");
                home.style.display = "none";
                element.appendChild(home);
            }
            const parked = home;
            this.shared.moveablesHome = parked;
            this.teardown.push(() => {
                // keep parked content alive: its portal still points at the moveable
                if (parked.childNodes.length === 0) {
                    parked.remove();
                }
                if (this.shared.moveablesHome === parked) {
                    this.shared.moveablesHome = null;
                }
            });
            const unsubscribe = this.model.subscribe((event) =>
                this.onModelEvent(event as unknown as CommandEvent),
            );
            this.teardown.push(unsubscribe);
        }

        // native drag listeners on the root (not framework events), so the same code path works
        // when the root lives in a popout document
        this.teardown.push(this.dragDropManager.attach(element));

        if (win) {
            if (win.ResizeObserver) {
                const observer = new win.ResizeObserver(() => {
                    this.updateRect();
                    this.applyMeasuredGeometry();
                });
                observer.observe(element);
                this.setGeometryResizeObserver(observer);
                this.teardown.push(() => {
                    this.setGeometryResizeObserver(undefined);
                    observer.disconnect();
                });
            }
            const resizeListener = () => this.updateRect();
            win.addEventListener("resize", resizeListener);
            this.teardown.push(() =>
                win.removeEventListener("resize", resizeListener),
            );
            if (this.isMainLayout()) {
                // a hidden page may have skipped measure passes: redraw when it shows
                const visibilityChange = () => this.redraw();
                doc.addEventListener("visibilitychange", visibilityChange);
                this.teardown.push(() =>
                    doc.removeEventListener(
                        "visibilitychange",
                        visibilityChange,
                    ),
                );
            }
        }

        this.updateRect();
        if (this.popoutManager) {
            this.popoutManager.attach();
            this.teardown.push(() => this.popoutManager?.detach());
        }
    }

    /** Detaches the root element and releases every observer and listener. */
    private detachRoot() {
        this.cancelHeal();
        while (this.teardown.length > 0) {
            this.teardown.pop()?.();
        }
        this.layoutRef = null;
        this.cachedLayoutDomRect = undefined;
    }

    /** Detaches and forgets everything. The engine must not be used afterwards. */
    private dispose() {
        this.setDragGroup(undefined);
        this.detachRoot();
        this.dragDropManager.dispose();
        this.popoutManager?.dispose();
        this.measurables.clear();
        this.rects.clear();
        this.tabPanels.clear();
        this.tabLists.clear();
        this.overflowTriggers.clear();
        this.overflowListeners.clear();
        if (this.main === this) {
            this.shared.listeners.clear();
        }
    }

    /**
     * Runs the measure-and-position cycle: measures every registered element, positions the tab
     * panels and discovers the splitter size. Call after every commit.
     */
    private sync() {
        const changed = this.applyMeasuredGeometry();
        if (changed) {
            // post-paint heal: re-measure after css settles (fonts, transitions)
            this.scheduleHeal();
        }
    }

    // *********************************************************************************
    // Model events
    // *********************************************************************************

    private onModelEvent(event: CommandEvent) {
        if (event.command === "window.configure") {
            return; // only a window's screen rect changed: nothing draws it
        }
        this.forgetRemoved();
        if (event.transient && event.command === "row.resize") {
            if (
                this.applyTransientWeights(
                    event.payload as { row: string; weights: number[] },
                )
            ) {
                return;
            }
        } else if (event.transient && event.command === "border.resize") {
            if (
                this.applyTransientBorderSize(
                    event.payload as { border: string },
                )
            ) {
                return;
            }
        }
        this.popoutManager?.sync();
        this.redraw();
    }

    /** drops the view state of tabs no longer in the model (a closed tab's moveable is released) */
    private forgetRemoved() {
        const shared = this.shared;
        for (const id of [...shared.moveables.keys()]) {
            if (this.model.get("node", { node: id })?.type !== "tab") {
                shared.moveables.delete(id);
            }
        }
        for (const id of [...shared.rendered]) {
            if (this.model.get("node", { node: id })?.type !== "tab") {
                shared.rendered.delete(id);
                shared.scroll.delete(id);
            }
        }
    }

    /** the engine of the layout a node is in (a popout's, or this main one) */
    private engineOf(id: string): LayoutEngine<T> {
        const layout = this.model.get("layout-id", { node: id });
        if (layout === undefined || layout === MAIN_LAYOUT) {
            return this.main;
        }
        return this.main.popoutManager?.getLayoutEngine(layout) ?? this.main;
    }

    private applyTransientWeights(payload: {
        row: string;
        weights: number[];
    }): boolean {
        const row = this.model.get("node", { node: payload.row });
        if (row?.type !== "row") {
            return false;
        }
        const engine = this.engineOf(row.id);
        for (const [i, child] of row.children.entries()) {
            const weight = payload.weights[i];
            const element = engine.measurables.get(
                `${child.type}:${child.id}`,
            )?.element;
            if (weight === undefined || !element) {
                return false; // not registered: fall back to the re-render path
            }
            // NOTE: flex-grow cannot have values < 1 otherwise it will not fill the parent
            element.style.flexGrow = String(Math.max(1, weight * 1000));
        }
        engine.applyMeasuredGeometry();
        return true;
    }

    private applyTransientBorderSize(payload: { border: string }): boolean {
        const border = this.model.get("node", { node: payload.border });
        if (border?.type !== "border") {
            return false;
        }
        const resolved = resolveBorder(
            this.state().defaults,
            border as unknown as AnyBorder,
        );
        if (resolved.mode === "overlay") {
            return false; // an overlay's placement depends on the other open overlays
        }
        const element = this.measurables.get(
            `bordercontent:${border.id}`,
        )?.element;
        if (!element) {
            return false;
        }
        if (border.location === "left" || border.location === "right") {
            element.style.width = `${resolved.size}px`;
            element.style.minWidth = `${resolved.minSize}px`;
            element.style.maxWidth = `${resolved.maxSize}px`;
        } else {
            element.style.height = `${resolved.size}px`;
            element.style.minHeight = `${resolved.minSize}px`;
            element.style.maxHeight = `${resolved.maxSize}px`;
        }
        this.applyMeasuredGeometry();
        return true;
    }

    /** asks adapters to re-render */
    private redraw() {
        const shared = this.shared;
        shared.revision++;
        for (const listener of [...shared.listeners]) {
            listener();
        }
    }

    // *********************************************************************************
    // Registration
    // *********************************************************************************

    /** Registers (or, with `null`, unregisters) an element whose geometry the engine measures. */
    private registerMeasurable(
        id: string,
        kind: MeasurableKind,
        element: HTMLElement | null,
    ) {
        const key = `${kind}:${id}`;
        const prev = this.measurables.get(key);
        if (element) {
            this.measurables.set(key, { kind, id, element });
        } else {
            this.measurables.delete(key);
            // an unmounted border strip or panel area must not leave a ghost that takes drops
            if (kind === "borderheader" || kind === "bordercontent") {
                this.rects.delete(key);
            }
        }
        if (prev?.element !== element) {
            if (prev) {
                this.geometryResizeObserver?.unobserve(prev.element);
            }
            if (element) {
                this.geometryResizeObserver?.observe(element);
            }
        }
    }

    /**
     * Registers (or, with `null`, unregisters) a tab container's tab list for tab overflow: when its
     * tabs do not fit, the engine hides the ones that do not (keeping the selected one) and reports
     * them through {@link getHiddenTabs}. `vertical` is the direction the tabs run.
     */
    private registerTabList(
        containerId: string,
        element: HTMLElement | null,
        vertical = false,
    ) {
        const prev = this.tabLists.get(containerId);
        if (prev && prev.element !== element) {
            this.geometryResizeObserver?.unobserve(prev.element);
        }
        if (element) {
            this.tabLists.set(containerId, { element, vertical });
            if (prev?.element !== element) {
                this.geometryResizeObserver?.observe(element);
            }
        } else {
            this.tabLists.delete(containerId);
            this.setHiddenTabs(containerId, []);
        }
    }

    /**
     * Registers (or unregisters) the overflow trigger of a tab container: the element that opens
     * the consumer's menu of hidden tabs. The space it takes is reserved in the strip.
     */
    private registerOverflowTrigger(
        containerId: string,
        element: HTMLElement | null,
    ) {
        const prev = this.overflowTriggers.get(containerId);
        if (prev && prev !== element) {
            this.geometryResizeObserver?.unobserve(prev);
        }
        if (element) {
            this.overflowTriggers.set(containerId, element);
            this.geometryResizeObserver?.observe(element);
        } else {
            this.overflowTriggers.delete(containerId);
        }
    }

    /** The ids of a tab container's tabs hidden by tab overflow (the same array until it changes). */
    private readonly getHiddenTabs = (containerId: string): readonly string[] =>
        this.hiddenTabs.get(containerId) ?? NO_TABS;

    /** Calls `listener` when a container's hidden tabs change. Returns the unsubscribe function. */
    private readonly subscribeOverflow = (
        listener: () => void,
    ): (() => void) => {
        this.overflowListeners.add(listener);
        return () => {
            this.overflowListeners.delete(listener);
        };
    };

    private setHiddenTabs(containerId: string, hidden: readonly string[]) {
        const prev = this.getHiddenTabs(containerId);
        if (
            prev.length === hidden.length &&
            prev.every((id, i) => id === hidden[i])
        ) {
            return false;
        }
        if (hidden.length === 0) {
            this.hiddenTabs.delete(containerId);
        } else {
            this.hiddenTabs.set(containerId, hidden);
        }
        return true;
    }

    /** measures every registered tab list and decides which tabs it hides; notifies on change */
    private updateTabOverflow() {
        let changed = false;
        for (const [id, list] of this.tabLists) {
            const container = this.model.get("node", { node: id });
            if (container?.type !== "tabset" && container?.type !== "border") {
                continue; // the container left the model
            }
            const { element, vertical } = list;
            const tabs = container.children;
            const hidden = new Set(this.getHiddenTabs(id));
            const listRect = this.measureElement(element);
            const view = element.ownerDocument.defaultView;
            const style = view?.getComputedStyle(element);
            const px = (value: string | undefined) =>
                Number.parseFloat(value ?? "") || 0;
            // a border only counts when drawn (some engines report a width for `none`)
            const line = (
                width: string | undefined,
                kind: string | undefined,
            ) => (kind === "none" || kind === "hidden" ? 0 : px(width));
            const inset = vertical
                ? px(style?.paddingTop) +
                  px(style?.paddingBottom) +
                  line(style?.borderTopWidth, style?.borderTopStyle) +
                  line(style?.borderBottomWidth, style?.borderBottomStyle)
                : px(style?.paddingLeft) +
                  px(style?.paddingRight) +
                  line(style?.borderLeftWidth, style?.borderLeftStyle) +
                  line(style?.borderRightWidth, style?.borderRightStyle);
            const gap = px(vertical ? style?.rowGap : style?.columnGap);
            const inner = (vertical ? listRect.height : listRect.width) - inset;
            if (inner <= 0) {
                continue; // not laid out (hidden, or not measured yet)
            }
            const sizes = tabs.map((tab) => {
                const button = this.measurables.get(
                    `tabbutton:${tab.id}`,
                )?.element;
                if (button && !hidden.has(tab.id)) {
                    const r = this.measureElement(button);
                    const size = vertical ? r.height : r.width;
                    if (size > 0) {
                        this.naturalTabSizes.set(tab.id, size);
                    }
                }
                return this.naturalTabSizes.get(tab.id) ?? 0;
            });
            // the space the trigger takes while it shows: its size, its margins and the gap before it
            const trigger = this.overflowTriggers.get(id);
            let taken = 0;
            if (trigger) {
                const r = this.measureElement(trigger);
                const own = view?.getComputedStyle(trigger);
                const parent = trigger.parentElement;
                const parentStyle = parent
                    ? view?.getComputedStyle(parent)
                    : undefined;
                const siblings = parent ? parent.children.length > 1 : false;
                taken =
                    (vertical ? r.height : r.width) +
                    (vertical
                        ? px(own?.marginTop) + px(own?.marginBottom)
                        : px(own?.marginLeft) + px(own?.marginRight)) +
                    (siblings
                        ? px(
                              vertical
                                  ? parentStyle?.rowGap
                                  : parentStyle?.columnGap,
                          )
                        : 0);
                if (taken > 0) {
                    this.triggerSpace.set(id, taken);
                }
            }
            const result = computeTabOverflow({
                available: inner + taken,
                sizes,
                gap,
                selectedIndex: container.selected,
                reserve: this.triggerSpace.get(id) ?? 0,
            });
            const next = result.hidden.map((index) => tabs[index]?.id ?? "");
            changed = this.setHiddenTabs(id, next) || changed;
        }
        if (changed) {
            for (const listener of [...this.overflowListeners]) {
                listener();
            }
        }
    }

    /** Registers (or unregisters) the element a tab's content panel is positioned with. */
    private registerTabPanel(tabId: string, element: HTMLElement | null) {
        if (element) {
            this.tabPanels.set(tabId, element);
        } else {
            this.tabPanels.delete(tabId);
        }
    }

    /**
     * Registers (or unregisters) a splitter element. Its thickness (width while `isHorizontal()`,
     * i.e. the splitter sits between side by side children; height otherwise) becomes the
     * splitter size. The orientation is read at every measure pass, since a row can flip it.
     */
    private registerSplitter(
        element: HTMLElement,
        isHorizontal: () => boolean,
        register = true,
    ) {
        const splitters = this.shared.splitters;
        if (register) {
            if (!splitters.has(element)) {
                this.geometryResizeObserver?.observe(element);
            }
            splitters.set(element, isHorizontal);
        } else if (splitters.delete(element)) {
            this.geometryResizeObserver?.unobserve(element);
        }
    }

    /** @internal the registered elements (tests and debugging) */
    private getRegistrations() {
        return {
            measurables: this.measurables,
            tabPanels: this.tabPanels,
            splitters: this.shared.splitters,
        };
    }

    // *********************************************************************************
    // Measure and position
    // *********************************************************************************

    /** A measured rect of a node of this layout, relative to the layout root. */
    private rect(kind: MeasurableKind, id: string): Rect | undefined {
        return this.rects.get(`${kind}:${id}`);
    }

    /** The content area a tab's panel is positioned over (its tabset's, or its border's). */
    private contentRect(containerId: string): Rect | undefined {
        const container = this.model.get("node", { node: containerId });
        if (container?.type === "border") {
            return this.rect("bordercontent", containerId);
        }
        return this.rect("tabsetcontent", containerId);
    }

    /** @internal measures every registered element; returns true on change */
    private syncLayoutMetrics(): boolean {
        this.cachedLayoutDomRect = undefined;
        let changed = false;
        for (const [key, { kind, element }] of this.measurables) {
            if (!element.isConnected) {
                continue;
            }
            const rect = this.rectInLayout(element);
            const previous = this.rects.get(key);
            if (kind === "tabsetcontent" || kind === "bordercontent") {
                if (
                    Number.isNaN(rect.x) ||
                    (kind === "bordercontent" && rect.width <= 0)
                ) {
                    continue;
                }
                if (!equalsWhenRounded(previous, rect)) {
                    const hadSize =
                        !!previous && previous.width > 0 && previous.height > 0;
                    this.rects.set(key, rect);
                    changed = true;
                    if (!hadSize && rect.width > 0 && rect.height > 0) {
                        // the content render waits for a sized content area: the first time one
                        // gets a size, re-render to mount the content
                        this.reLayout = true;
                    }
                }
            } else if (!equalsWhenRounded(previous, rect)) {
                this.rects.set(key, rect);
                changed = true;
            }
        }
        return changed;
    }

    /** Whether a tab's panel is shown: selected, and not hidden by a maximize or a hidden border. */
    private isPanelVisible(tabId: string): boolean {
        const container = this.model.get("parent", { node: tabId });
        if (container?.type !== "tabset" && container?.type !== "border") {
            return false;
        }
        if (container.children[container.selected]?.id !== tabId) {
            return false;
        }
        if (container.type === "tabset") {
            const layout = this.model.get("layout-id", { node: container.id });
            const maximized =
                layout === undefined
                    ? undefined
                    : this.model.get("maximized-tabset", { layout });
            return maximized === undefined || maximized.id === container.id;
        }
        return container.show !== false;
    }

    /**
     * Positions the tab panels over their container's content area and shows only the visible
     * ones. Writes only structural style: `position`, `left`, `top`, `width`, `height`, `display`.
     */
    private positionTabPanels() {
        for (const [tabId, element] of this.tabPanels) {
            const container = this.model.get("parent", { node: tabId });
            if (!container) {
                continue; // the tab left the tree (it is being closed)
            }
            const rect = this.contentRect(container.id) ?? EMPTY_RECT;
            positionElement(element, rect);
            element.style.display = this.isPanelVisible(tabId) ? "" : "none";
        }
    }

    /** measures the splitter thickness; returns true on change */
    private syncSplitterSize(): boolean {
        for (const [element, isHorizontal] of this.shared.splitters) {
            if (!element.isConnected) {
                continue;
            }
            const r = this.measureElement(element);
            const size = isHorizontal() ? r.width : r.height;
            if (size <= 0) {
                continue; // hidden (e.g. while a tabset is maximized)
            }
            if (Math.abs(size - this.shared.splitterSize) > 0.5) {
                this.shared.splitterSize = size;
                return true;
            }
            return false;
        }
        return false;
    }

    private applyMeasuredGeometry(): boolean {
        const changed = this.syncLayoutMetrics();
        this.positionTabPanels();
        this.updateTabOverflow();
        const splitterSizeChanged = this.syncSplitterSize();
        if (splitterSizeChanged || this.reLayout) {
            this.reLayout = false;
            this.redraw();
        }
        return changed;
    }

    private scheduleHeal() {
        const win = this.layoutRef?.ownerDocument.defaultView;
        if (!win) {
            return;
        }
        this.cancelHeal();
        this.healFrame = win.requestAnimationFrame(() => {
            this.healFrame = undefined;
            this.applyMeasuredGeometry();
        });
    }

    private cancelHeal() {
        if (this.healFrame !== undefined) {
            this.layoutRef?.ownerDocument.defaultView?.cancelAnimationFrame(
                this.healFrame,
            );
            this.healFrame = undefined;
        }
    }

    private setGeometryResizeObserver(observer: ResizeObserver | undefined) {
        this.geometryResizeObserver = observer;
        if (observer) {
            for (const { element } of this.measurables.values()) {
                observer.observe(element);
            }
            for (const element of this.shared.splitters.keys()) {
                observer.observe(element);
            }
            for (const { element } of this.tabLists.values()) {
                observer.observe(element);
            }
            for (const element of this.overflowTriggers.values()) {
                observer.observe(element);
            }
        }
    }

    /** re-measures the layout root; a changed size relayouts */
    private readonly updateRect = () => {
        const element = this.layoutRef;
        if (!element) {
            return;
        }
        const rect = toRect(this.measureElement(element));
        if (
            !equalsWhenRounded(rect, this.lastRect) &&
            rect.width !== 0 &&
            rect.height !== 0
        ) {
            this.lastRect = rect;
            this.redraw();
        }
    };

    // *********************************************************************************
    // Moveable elements and rendering
    // *********************************************************************************

    /**
     * The element that hosts a tab's content: `<div data-dockable-moveable>` in the main layout's
     * document, created on first use and kept (by tab id) for as long as the tab exists, so moving
     * a tab, or loading a layout that keeps its id, never remounts its content.
     */
    private getMoveableElement(tabId: string): HTMLElement {
        const shared = this.shared;
        let element = shared.moveables.get(tabId);
        if (!element) {
            const doc =
                this.main.currentDocument ??
                this.main.layoutRef?.ownerDocument ??
                this.layoutRef?.ownerDocument;
            if (!doc) {
                throw new Error(
                    "LayoutEngine.getMoveableElement: attach a root element first",
                );
            }
            element = doc.createElement("div");
            element.setAttribute(MOVEABLE_ATTRIBUTE, "");
            element.style.width = "100%";
            element.style.height = "100%";
            shared.moveables.set(tabId, element);
        }
        return element;
    }

    /** @internal hands a tab's moveable element over (a drag group transfer); undefined if none */
    private takeMoveable(tabId: string): HTMLElement | undefined {
        const element = this.shared.moveables.get(tabId);
        this.shared.moveables.delete(tabId);
        this.shared.rendered.delete(tabId);
        return element;
    }

    /** @internal adopts another model's moveable element for a tab (a drag group transfer) */
    private adoptMoveable(tabId: string, element: HTMLElement | undefined) {
        if (element) {
            this.shared.moveables.set(tabId, element);
            this.shared.rendered.add(tabId);
        }
    }

    /**
     * Moves the tab's moveable element into `panel` (its current panel). The same element is
     * re-parented, never cloned, so content state survives moves between panels and documents.
     */
    private attachMoveable(
        tabId: string,
        panel: HTMLElement,
        options: MoveableOptions = {},
    ) {
        const element = this.getMoveableElement(tabId);
        element.style.overflow =
            options.scrollable === false ? "hidden" : "auto";
        if (element.parentElement !== panel) {
            // appendChild adopts the node into the panel's document; identity is what preserves
            // the content's state, so the element is never imported or cloned
            panel.appendChild(element);
            this.restoreScroll(tabId, element);
        }
        // keep the scroll position, so it can be restored after a move. One listener per element
        // for its whole life: the element outlives engines, so the listener reads its current tab
        const tracking = scrollTracking.get(element);
        if (tracking) {
            tracking.tab = tabId;
            tracking.view = this.shared;
        } else {
            const state = { tab: tabId, view: this.shared };
            element.addEventListener("scroll", () => {
                state.view.scroll.set(state.tab, {
                    top: element.scrollTop,
                    left: element.scrollLeft,
                });
            });
            scrollTracking.set(element, state);
        }
    }

    private restoreScroll(tabId: string, element: HTMLElement) {
        const scroll = this.shared.scroll.get(tabId);
        // the frame callback comes from the element's own window, so a tab restored inside a
        // popout schedules on the popout's frame loop
        const view = element.ownerDocument.defaultView;
        if (view && scroll && (scroll.top || scroll.left)) {
            view.requestAnimationFrame(() => {
                element.scrollTop = scroll.top;
                element.scrollLeft = scroll.left;
            });
        }
    }

    /**
     * Parks the tab's moveable element in the hidden moveables home when its panel goes away, so
     * the content's DOM (and the framework state rendered into it) is never destroyed by
     * unmounting a panel. A later {@link attachMoveable} moves the same element into a new panel.
     */
    private releaseMoveable(
        tabId: string,
        panel?: HTMLElement,
        options: MoveableOptions = {},
    ) {
        const element = this.shared.moveables.get(tabId);
        if (!element) {
            return; // the tab is gone: nothing to park
        }
        if (panel !== undefined && element.parentElement !== panel) {
            return; // already attached elsewhere
        }
        const home = this.shared.moveablesHome;
        if (
            home &&
            this.model.get("node", { node: tabId }) &&
            options.remountInWindow !== true
        ) {
            home.appendChild(element); // keep it parented, so it stays in the document
        }
    }

    /** the hidden element moveables are parked in (main layout only) */
    private getMoveablesHome(): HTMLElement | null {
        return this.shared.moveablesHome;
    }

    /**
     * Whether a tab's content should be rendered: once rendered it stays rendered (its state is
     * kept); before that, when its container's content area has a size and it is selected (or
     * `renderOnDemand` is off). Marks it rendered.
     */
    private shouldRender(tabId: string, renderOnDemand = true): boolean {
        const shared = this.shared;
        if (shared.rendered.has(tabId)) {
            return true;
        }
        const container = this.model.get("parent", { node: tabId });
        if (container?.type !== "tabset" && container?.type !== "border") {
            return false;
        }
        const selected = container.children[container.selected]?.id === tabId;
        if (!selected && renderOnDemand) {
            return false;
        }
        const rect = this.engineOf(tabId).contentRect(container.id);
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return false;
        }
        shared.rendered.add(tabId);
        return true;
    }

    // *********************************************************************************
    // Overlay borders and keyboard focus
    // *********************************************************************************

    private openOverlayBorders(): AnyBorder[] {
        const state = this.state();
        return state.borders.filter((border) => {
            const resolved = resolveBorder(state.defaults, border);
            return (
                resolved.show &&
                resolved.mode === "overlay" &&
                border.selected !== -1
            );
        });
    }

    /**
     * Closes an overlay border's panel (`border.configure` with `open: false`). When focus was in
     * the panel, it goes back to the tab button.
     */
    private closeOverlayBorder(
        borderId: string,
        dryRun = false,
    ): CommandResult<{ border: string }> {
        const border = this.model.get("node", { node: borderId });
        if (border?.type !== "border") {
            return notFound(`"${borderId}" is not a border`);
        }
        const tab = border.children[border.selected];
        if (!tab) {
            return refused(`"${borderId}" is not open`);
        }
        if (dryRun) {
            return this.model.check("border.configure", {
                border: borderId,
                open: false,
            });
        }
        const doc = this.currentDocument;
        const panel = doc?.getElementById(this.tabPanelId(tab.id));
        const refocus =
            doc?.activeElement != null && panel?.contains(doc.activeElement);
        const result = this.model.run("border.configure", {
            border: borderId,
            open: false,
        });
        if (result.ok && refocus) {
            doc?.getElementById(this.tabButtonId(tab.id))?.focus();
        }
        return result;
    }

    /**
     * Ported from FlexLayout's LayoutController.onOverlayBorderPointerDown. Call it on every
     * `pointerdown` of the document (capture phase). A press in the main layout's area (not on a
     * border strip) outside an open overlay panel closes that panel. Presses inside an overlay
     * (anything marked `data-dockable-overlay`) keep it open. Returns true when a panel closed.
     */
    private handleOverlayPointerDown(event: {
        target: EventTarget | null;
        clientX: number;
        clientY: number;
    }): boolean {
        const open = this.openOverlayBorders();
        if (open.length === 0 || !this.layoutRef) {
            return false;
        }
        const target = event.target as Element | null;
        if (target?.closest?.(`[${OVERLAY_ATTRIBUTE}]`)) {
            return false;
        }
        const root = this.getFreshDomRect();
        const x = event.clientX - root.x;
        const y = event.clientY - root.y;
        const main = this.rect("row", this.state().root.id);
        if (!main || !contains(main, x, y)) {
            return false; // a border strip, or outside the layout
        }
        let closed = false;
        for (const border of open) {
            const content = this.rect("bordercontent", border.id);
            if (!content || !contains(content, x, y)) {
                this.closeOverlayBorder(border.id);
                closed = true;
            }
        }
        return closed;
    }

    /**
     * Ported from FlexLayout's LayoutController.onOverlayBorderKeyDown. Call it on every `keydown`
     * with the close key: with focus in an open overlay panel or on its tab button, the key closes
     * the panel and focus goes to the tab button. Returns true (and prevents the default) when a
     * panel closed.
     */
    private handleOverlayKeyDown(
        event: IKeyEventLike & { preventDefault(): void },
        key: string | undefined,
    ): boolean {
        const doc = this.currentDocument;
        const active = doc?.activeElement;
        if (!key || !doc || !active || !matchesKey(event, key)) {
            return false;
        }
        for (const border of this.openOverlayBorders()) {
            const tab = border.children[border.selected];
            if (!tab) {
                continue;
            }
            const button = doc.getElementById(this.tabButtonId(tab.id));
            const panel = doc.getElementById(this.tabPanelId(tab.id));
            if (active === button || panel?.contains(active)) {
                this.closeOverlayBorder(border.id);
                button?.focus();
                event.preventDefault();
                return true;
            }
        }
        return false;
    }

    /**
     * Moves focus to the selected tab button of the next/previous tabset in this layout
     * (wrapping), starting from the tabset containing focus and falling back to the active one;
     * the target becomes the active tabset. Returns true when focus moved.
     */
    private focusAdjacentTabset(
        delta: number,
        dryRun: boolean,
    ): CommandResult<{ tabset: string }> {
        const doc = this.currentDocument;
        const active = doc?.activeElement;
        if (!doc || !active || !this.layoutRef?.contains(active)) {
            return refused("focus is not in this layout");
        }
        // leave text editing contexts alone
        const tag = active.tagName;
        if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            (active as HTMLElement).isContentEditable ||
            active.closest('[role="menu"]')
        ) {
            return refused("focus is in a text field or a menu");
        }
        if (
            this.model.get("maximized-tabset", { layout: this.layoutId }) !==
            undefined
        ) {
            return refused("a tabset is maximized: it is the only one shown");
        }
        const tabsets = this.model
            .get("tabsets", { layout: this.layoutId })
            .filter((tabset) => tabset.children[tabset.selected] !== undefined);
        if (tabsets.length < 2) {
            return refused("no other tabset to move focus to");
        }
        const containsFocus = (tabset: (typeof tabsets)[number]) => {
            if (
                this.measurables
                    .get(`tabset:${tabset.id}`)
                    ?.element.contains(active)
            ) {
                return true; // focus in the tab strip
            }
            const selected = tabset.children[tabset.selected];
            return (
                !!selected &&
                !!this.tabPanels.get(selected.id)?.contains(active)
            );
        };
        let index = tabsets.findIndex(containsFocus);
        if (index === -1) {
            const activeTabset = this.model.get("active-tabset", {
                layout: this.layoutId,
            });
            index = activeTabset
                ? tabsets.findIndex((t) => t.id === activeTabset.id)
                : 0;
            if (index === -1) {
                index = 0;
            }
        }
        const target =
            tabsets[(index + delta + tabsets.length) % tabsets.length];
        const selected = target?.children[target.selected];
        if (!target || !selected) {
            return refused("no other tabset to move focus to");
        }
        if (!dryRun) {
            this.measurables.get(`tabbutton:${selected.id}`)?.element.focus();
            // focus moved whether or not a middleware lets the tabset become active
            this.model.run("tabset.activate", { tabset: target.id });
        }
        return { ok: true, value: { tabset: target.id } };
    }

    // *********************************************************************************
    // Splitters and drag state
    // *********************************************************************************

    private isRealtimeResize() {
        return this.main.realtimeResize;
    }

    /** true while any splitter of the model is being dragged */
    private isSplitterDragging() {
        return this.shared.splitterDragging;
    }

    private setSplitterDragging(dragging: boolean) {
        this.shared.splitterDragging = dragging;
    }

    /** the drag-and-drop state machine of this layout */
    private getDragDropManager(): DragDropManager<T> {
        return this.dragDropManager;
    }

    /** seconds a view may take to animate the drop outline */
    private getTabDragSpeed(): number {
        return this.main.tabDragSpeed;
    }

    /**
     * The edge drop bands of this layout's root row, relative to the layout root: where a drop docks
     * to an edge, and where an edge indicator goes. Empty when edge docking is off.
     */
    private edgeBands(): EdgeBand[] {
        const settings = resolveLayout(this.state().defaults);
        const root = this.rootRow(this.state());
        const rect = root ? this.rect("row", root.id) : undefined;
        if (!settings.edgeDock || !rect) {
            return [];
        }
        return edgeBands(
            rect,
            settings.edgeDockMargin,
            settings.edgeDockLength,
        );
    }

    // *********************************************************************************
    // Popouts
    // *********************************************************************************

    /** the popout windows of the model (owned by the main engine) */
    private getPopoutManager(): PopoutManager<T> {
        const manager = this.main.popoutManager;
        if (!manager) {
            throw new Error(
                "LayoutEngine: the main engine has no popout manager",
            );
        }
        return manager;
    }

    /** whether window layouts open as native popouts */
    private isSupportsPopout(): boolean {
        return this.getPopoutManager().isSupportsPopout();
    }

    /** Pops a node (a tab, or a whole tabset) out into a window, at its place on screen. */
    private popout(
        id: string,
        dryRun: boolean,
    ): CommandResult<{ window: string }> {
        if (!this.isSupportsPopout()) {
            return refused("popout windows are not supported here");
        }
        const execute = dryRun ? this.model.check : this.model.run;
        const node = this.model.get("node", { node: id });
        const engine = this.engineOf(id);
        if (node?.type === "tabset") {
            const rect = engine.rect("tabset", id);
            return execute("tabset.popout", {
                tabset: id,
                ...(rect ? { rect: engine.getScreenRect(rect) } : {}),
            });
        }
        if (node?.type !== "tab") {
            return notFound(`"${id}" is not a tab or a tabset`);
        }
        const container = this.model.get("parent", { node: id });
        const rect = container ? engine.contentRect(container.id) : undefined;
        return execute("tab.popout", {
            tab: id,
            ...(rect ? { rect: engine.getScreenRect(rect) } : {}),
        });
    }

    /**
     * Docks a node (a tab, or a tabset) of a window back into the main layout's active tabset (its
     * first one otherwise). When it is all its window holds, the window closes (`window.close`);
     * otherwise its tabs move (`tab.move`).
     */
    private dockBack(
        id: string,
        dryRun: boolean,
    ): CommandResult<{ tabs: string[] }> {
        const layout = this.model.get("layout-id", { node: id });
        if (layout === undefined || layout === MAIN_LAYOUT) {
            return refused(`"${id}" is not in a window`);
        }
        const execute = dryRun ? this.model.check : this.model.run;
        const node = this.model.get("node", { node: id });
        const tabs =
            node?.type === "tabset" ? node.children.map((t) => t.id) : [id];
        const docked = (
            result: CommandResult<unknown>,
        ): CommandResult<{ tabs: string[] }> =>
            result.ok ? { ok: true, value: { tabs } } : result;
        const all = this.model.get("tabs", { layout }).map((t) => t.id);
        if (all.length === tabs.length) {
            return docked(execute("window.close", { window: layout }));
        }
        const target =
            this.model.get("active-tabset") ?? this.model.get("tabsets")[0];
        if (!target) {
            return docked(execute("window.close", { window: layout }));
        }
        // a pinned tab may not leave its tabset: it is unpinned for the move and pinned again
        const commands: BatchEntry<T>[] = [];
        for (const tab of tabs) {
            const node = this.model.get("node", { node: tab });
            const pinned = node?.type === "tab" && node.pinned === true;
            if (pinned) {
                commands.push({
                    command: "tab.pin",
                    payload: { tab, value: false },
                });
            }
            commands.push({
                command: "tab.move",
                payload: { tab, to: target.id, index: -1 },
            });
            if (pinned) {
                commands.push({
                    command: "tab.pin",
                    payload: { tab, value: true },
                });
            }
        }
        return docked(execute("batch", { commands }));
    }

    // *********************************************************************************
    // Geometry
    // *********************************************************************************

    /** an element's rect relative to the layout root */
    private rectInLayout(element: HTMLElement): Rect {
        return relativeTo(
            toRect(this.measureElement(element)),
            this.getDomRect(),
        );
    }

    /** the layout root's rect in viewport coordinates, measured now (not the per-pass cache) */
    private getFreshDomRect(): Rect {
        this.cachedLayoutDomRect = undefined;
        return this.getDomRect();
    }

    /** the layout root's rect in viewport coordinates */
    private getDomRect(): Rect {
        if (this.cachedLayoutDomRect !== undefined) {
            return this.cachedLayoutDomRect;
        }
        if (this.layoutRef) {
            this.cachedLayoutDomRect = toRect(
                this.measureElement(this.layoutRef),
            );
            return this.cachedLayoutDomRect;
        }
        return EMPTY_RECT;
    }

    /** a layout-relative rect in screen coordinates (for opening popout windows) */
    private getScreenRect(inRect: Rect): Rect {
        const win = this.currentWindow;
        if (!win) {
            return inRect;
        }
        const layoutRect = this.getDomRect();
        // measure window chrome; fall back to typical sizes under zoom
        const measuredNavHeight = win.outerHeight - win.innerHeight;
        const measuredNavWidth = win.outerWidth - win.innerWidth;
        const navHeight =
            measuredNavHeight >= 0 && measuredNavHeight <= 200
                ? measuredNavHeight
                : 60;
        const navWidth =
            measuredNavWidth >= 0 && measuredNavWidth <= 100
                ? measuredNavWidth
                : 2;
        return {
            x:
                win.screenX +
                win.scrollX +
                navWidth / 2 +
                layoutRect.x +
                inRect.x,
            y:
                win.screenY +
                win.scrollY +
                (navHeight - navWidth / 2) +
                layoutRect.y +
                inRect.y,
            width: inRect.width + navWidth,
            height: inRect.height + navHeight,
        };
    }

    // *********************************************************************************
    // Accessors
    // *********************************************************************************

    private isMainLayout(): boolean {
        return this.main === this;
    }

    private getLayoutRef(): HTMLElement | null {
        return this.layoutRef;
    }

    private getCurrentDocument(): Document | undefined {
        return this.currentDocument;
    }

    private getCurrentWindow(): Window | undefined {
        return this.currentWindow;
    }
}

/** Creates a {@link LayoutEngine} for a layout of a model (the main layout by default). */
export function createLayoutEngine<T extends DockableTypes = AnyTypes>(
    options: LayoutEngineOptions<T>,
): LayoutEngine<T> {
    return new LayoutEngine<T>(options);
}
