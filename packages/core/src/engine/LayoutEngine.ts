// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// and src/view/layout/LayoutInternal.tsx (the measure-and-position cycle, moveable element
// handling and the observers that drive them), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// The engine reads the model's immutable state, keeps every piece of view state (rects, moveable
// elements, scroll, "rendered") keyed by node id, and changes the layout only through commands.
import type { CommandEvent, CommandResult } from "../commands/types";
import { DragDropManager, type OnExternalDrag } from "../dnd/DragDropManager";
import type { DragGroup } from "../dnd/DragGroup";
import { PopoutManager, type PopoutOptions } from "../popout/PopoutManager";
import { flexGrow } from "../split/split";
import type { Model } from "../state/model";
import type { QueryArgs } from "../state/queries";
import { type AnyTypes, type DockableTypes, MAIN_LAYOUT } from "../state/types";
import type { LayoutEngineAdapter } from "./adapter";
import { Derived } from "./derived";
import { defaultMeasure, Measure, type MeasureFunction } from "./measure";
import { Moveables } from "./moveables";
import { Overflow } from "./overflow";
import { Overlay } from "./overlay";
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
import { Windows } from "./windows";

export interface LayoutEngineOptions<T extends DockableTypes = AnyTypes> {
    model: Model<T>;
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

/** The handler a verb's table holds for `key`, if it is one of its own keys. */
function handlerOf<F>(table: object, key: string): F | undefined {
    return Object.hasOwn(table, key)
        ? (table as Record<string, F>)[key]
        : undefined;
}

/** The view state every engine of a model shares (owned by the main engine). */
export class SharedView {
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

/**
 * One layout on screen: the main layout's, or a popout window's (one engine per window). It
 * measures the elements an adapter registers, positions tab panels over their content area
 * (structural style only), owns the moveable elements that host tab content, and runs the drag
 * and drop and the popout windows. It never changes the model except through commands.
 *
 * An app uses its verbs, the same as the model's:
 *
 * - `run` performs a screen action (`engine.run("popout", { nodeId })`); `can` answers whether it
 *   would succeed, `check` returns what it would return;
 * - `get` reads a view fact (`engine.get("tab-panel-dom-id-by", { tabId })`); `is` asks a yes/no question
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
    private realtimeResize = true;
    private tabDragSpeed = 0.3;
    private onExternalDragHandler: OnExternalDrag<T> | undefined;
    private dragGroup: DragGroup | undefined;
    private leaveDragGroup: (() => void) | undefined;
    private readonly dragDropManager: DragDropManager;
    private readonly popoutManager: PopoutManager<T> | undefined;
    private readonly measure: Measure<T>;
    private readonly overflow: Overflow<T>;
    private readonly derived: Derived<T>;
    private readonly moveables: Moveables<T>;
    private readonly overlay: Overlay<T>;
    private readonly windows: Windows<T>;

    private currentDocument: Document | undefined;
    private currentWindow: Window | undefined;
    private readonly teardown: (() => void)[] = [];

    constructor(
        options: LayoutEngineOptions<T>,
        main?: LayoutEngine<T>,
        layoutId = MAIN_LAYOUT,
    ) {
        this.model = options.model;
        this.layoutId = layoutId;
        this.main = main ?? this;
        this.shared = main ? main.shared : new SharedView();
        if (!main) {
            this.shared.idScope = options.idScope ?? `d${++scopes}-`;
        }
        // the verbs can be passed around detached: `const { run } = engine`
        this.run = this.run.bind(this);
        this.can = this.can.bind(this);
        this.check = this.check.bind(this);
        this.get = this.get.bind(this);
        this.is = this.is.bind(this);
        this.measure = new Measure(
            this.model,
            this.shared,
            options.measure ?? defaultMeasure,
            {
                redraw: () => this.redraw(),
                updateTabOverflow: () => this.overflow.updateTabOverflow(),
                observeOverflow: (observer) => this.overflow.observe(observer),
            },
        );
        this.overflow = new Overflow(this.model, this.measure);
        this.derived = new Derived(
            this.model,
            layoutId,
            this.shared,
            this.measure,
            () => this.isMainLayout(),
        );
        this.moveables = new Moveables(this.model, this.shared, {
            ownerDocument: () =>
                this.main.currentDocument ??
                this.measure.layoutRef?.ownerDocument,
            measureOf: (id) => this.engineOf(id).measure,
        });
        this.dragDropManager = new DragDropManager(
            this as unknown as LayoutEngine<AnyTypes>,
        );
        this.overlay = new Overlay(
            this.model,
            layoutId,
            this.shared,
            this.measure,
            this.derived,
            this.dragDropManager,
            {
                ownerDocument: () => this.currentDocument,
                isMainLayout: () => this.isMainLayout(),
            },
        );
        this.windows = new Windows(this.model, this.measure, {
            isSupportsPopout: () => this.isSupportsPopout(),
            ownerWindow: () => this.currentWindow,
            windowsOf: (id) => this.engineOf(id).windows,
        });
        this.popoutManager = main ? undefined : new PopoutManager<T>(this);
        this.setOptions(options);
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
        const getter = handlerOf<(payload: unknown) => unknown>(
            this.getters,
            key,
        );
        return getter?.(payload[0] ?? {}) as EngineGetResult<K>;
    }

    /** asks a yes/no question about this layout on screen */
    is<K extends EngineIsKey>(
        key: K,
        ...payload: QueryArgs<EngineIsPayload<K>>
    ): boolean {
        const question = handlerOf<(payload: unknown) => boolean>(
            this.questions,
            key,
        );
        return question?.(payload[0] ?? {}) ?? false;
    }

    private act(
        action: string,
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const handler = handlerOf<
            (payload: unknown, dryRun: boolean) => CommandResult<unknown>
        >(this.actions, action);
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
        popout: ({ nodeId }, dryRun) => this.windows.popout(nodeId, dryRun),
        "dock-back": ({ nodeId }, dryRun) =>
            this.windows.dockBack(nodeId, dryRun),
        "focus-tabset": ({ direction }, dryRun) =>
            this.overlay.focusAdjacentTabset(
                direction === "previous" ? -1 : 1,
                dryRun,
            ),
        // borders belong to the main layout: its engine knows their panels and focus
        "close-overlay-border": ({ borderId }, dryRun) =>
            this.main.overlay.closeOverlayBorder(borderId, dryRun),
        "measure-and-position": (_payload, dryRun) => {
            if (!dryRun) {
                this.measure.sync();
            }
            return { ok: true, value: {} };
        },
    };

    private readonly getters: {
        [K in EngineGetKey]: (
            payload: EngineGetPayload<K>,
        ) => EngineGetResult<K>;
    } = {
        "layout-path-by": ({ nodeId }) => this.derived.path(nodeId),
        "tab-button-dom-id-by": ({ tabId }) => this.derived.tabButtonId(tabId),
        "tab-panel-dom-id-by": ({ tabId }) => this.derived.tabPanelId(tabId),
        "flex-by": ({ nodeId }) => this.derived.flex(nodeId),
        "overlay-placement-by": ({ borderId }) =>
            this.overlay.overlayPlacement(borderId),
        "popout-mode-by": ({ nodeId }) => this.popoutMode(nodeId),
        "splitter-size": () => this.splitterSize(),
        "owner-document": () => this.getCurrentDocument(),
        "owner-window": () => this.getCurrentWindow(),
    };

    private readonly questions: {
        [K in EngineIsKey]: (payload: EngineIsPayload<K>) => boolean;
    } = {
        "popout-supported": () => this.isSupportsPopout(),
        "tab-panel-visible": ({ tabId }) => this.measure.isPanelVisible(tabId),
        "main-layout": () => this.isMainLayout(),
        "splitter-dragging": () => this.isSplitterDragging(),
        "border-shown": ({ borderId }) => this.overlay.isBorderShown(borderId),
        "tab-tabbable": ({ tabId }) => this.overlay.isTabbable(tabId),
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
            engineOf: (id) => this.engineOf(id),
            createPopoutEngine: (layoutId) => this.createPopoutEngine(layoutId),
            setOptions: (options) => this.setOptions(options),
            subscribe: (listener) => this.subscribe(listener),
            getSnapshot: () => this.getSnapshot(),
            prepare: () => this.prepare(),
            rowOrientation: (rowId) => this.derived.rowOrientation(rowId),
            attachRoot: (element) => this.attachRoot(element),
            detachRoot: () => this.detachRoot(),
            dispose: () => this.dispose(),
            registerMeasurable: (id, kind, element) =>
                this.measure.registerMeasurable(id, kind, element),
            registerTabList: (containerId, element, vertical) =>
                this.overflow.registerTabList(containerId, element, vertical),
            registerOverflowTrigger: (containerId, element) =>
                this.overflow.registerOverflowTrigger(containerId, element),
            getHiddenTabs: (containerId) =>
                this.overflow.getHiddenTabs(containerId),
            subscribeOverflow: (listener) =>
                this.overflow.subscribeOverflow(listener),
            registerTabPanel: (tabId, element) =>
                this.measure.registerTabPanel(tabId, element),
            registerSplitter: (element, isHorizontal) =>
                this.measure.registerSplitter(element, isHorizontal),
            subscribeGeometry: (listener) =>
                this.measure.subscribeGeometry(listener),
            getRegistrations: () => this.measure.getRegistrations(),
            rect: (kind, id) => this.measure.rect(kind, id),
            rectInLayout: (element) => this.measure.rectInLayout(element),
            getDomRect: () => this.measure.getDomRect(),
            getFreshDomRect: () => this.measure.getFreshDomRect(),
            edgeBands: () => this.derived.edgeBands(),
            getMoveableElement: (tabId) =>
                this.moveables.getMoveableElement(tabId),
            attachMoveable: (tabId, panel, options) =>
                this.moveables.attachMoveable(tabId, panel, options),
            releaseMoveable: (tabId, panel, options) =>
                this.moveables.releaseMoveable(tabId, panel, options),
            takeMoveable: (tabId) => this.moveables.takeMoveable(tabId),
            adoptMoveable: (tabId, element) =>
                this.moveables.adoptMoveable(tabId, element),
            shouldRender: (tabId, renderOnDemand) =>
                this.moveables.shouldRender(tabId, renderOnDemand),
            handleOverlayPointerDown: (event) =>
                this.overlay.handleOverlayPointerDown(event),
            handleOverlayKeyDown: (event, key) =>
                this.overlay.handleOverlayKeyDown(event, key),
            isRealtimeResize: () => this.isRealtimeResize(),
            setSplitterDragging: (dragging) =>
                this.setSplitterDragging(dragging),
            getDragDropManager: () => this.getDragDropManager(),
            getDragGroup: () => this.getDragGroup(),
            getOnExternalDrag: () => this.getOnExternalDrag(),
            getTabDragSpeed: () => this.getTabDragSpeed(),
            getPopoutManager: () => this.getPopoutManager(),
        };
    }

    private createPopoutEngine(layoutId: string): LayoutEngine<T> {
        return new LayoutEngine<T>(
            { model: this.model, measure: this.measure.measureElement },
            this,
            layoutId,
        );
    }

    // *********************************************************************************
    // Adapter contract
    // *********************************************************************************

    private setOptions(options: LayoutEngineSettings<T>) {
        this.setDragGroup(options.dragGroup);
        this.popoutManager?.setOptions(options.popout ?? {});
        this.realtimeResize = options.realtimeResize ?? true;
        this.tabDragSpeed = options.tabDragSpeed ?? 0.3;
        this.onExternalDragHandler = options.onExternalDrag;
    }

    /** Joins (or leaves) a drag group. Only the main engine joins: popouts share its model. */
    private setDragGroup(group: DragGroup | undefined) {
        if (!this.isMainLayout() || group === this.dragGroup) {
            return;
        }
        this.leaveDragGroup?.();
        this.dragGroup = group;
        this.leaveDragGroup = group?.join(
            this as unknown as LayoutEngine<AnyTypes>,
        );
    }

    private getDragGroup(): DragGroup | undefined {
        return this.main.dragGroup;
    }

    private getOnExternalDrag(): OnExternalDrag<T> | undefined {
        return this.main.onExternalDragHandler;
    }

    private readonly subscribe = (listener: () => void): (() => void) => {
        this.shared.listeners.add(listener);
        return () => {
            this.shared.listeners.delete(listener);
        };
    };

    private readonly getSnapshot = (): number => this.shared.revision;

    private prepare() {
        this.measure.cachedLayoutDomRect = undefined;
    }

    private get idScope(): string {
        return this.shared.idScope;
    }

    /** The measured splitter thickness (shared by every layout of the model). */
    private splitterSize(): number {
        return this.shared.splitterSize;
    }

    private popoutMode(nodeId: string): "popout" | "dock" | undefined {
        if (this.model.is("node-in-window", { nodeId })) {
            return "dock";
        }
        return this.can("popout", { nodeId }) ? "popout" : undefined;
    }

    private attachRoot(element: HTMLElement) {
        if (this.measure.layoutRef === element && this.teardown.length > 0) {
            return;
        }
        this.detachRoot();
        this.measure.layoutRef = element;
        const doc = element.ownerDocument;
        const win = doc.defaultView ?? undefined;
        this.currentDocument = doc;
        this.currentWindow = win;

        if (this.isMainLayout()) {
            this.teardown.push(this.moveables.attachHome(element));
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
                    this.measure.updateRect();
                    this.measure.applyMeasuredGeometry();
                });
                observer.observe(element);
                this.measure.setGeometryResizeObserver(observer);
                this.teardown.push(() => {
                    this.measure.setGeometryResizeObserver(undefined);
                    observer.disconnect();
                });
            }
            const resizeListener = () => this.measure.updateRect();
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

        this.measure.updateRect();
        if (this.popoutManager) {
            this.popoutManager.attach();
            this.teardown.push(() => this.popoutManager?.detach());
        }
    }

    private detachRoot() {
        this.measure.cancelHeal();
        while (this.teardown.length > 0) {
            this.teardown.pop()?.();
        }
        this.measure.layoutRef = null;
        this.measure.cachedLayoutDomRect = undefined;
    }

    private dispose() {
        this.setDragGroup(undefined);
        this.detachRoot();
        this.dragDropManager.dispose();
        this.popoutManager?.dispose();
        this.measure.dispose();
        this.overflow.dispose();
        if (this.isMainLayout()) {
            this.shared.listeners.clear();
        }
    }

    // *********************************************************************************
    // Model events
    // *********************************************************************************

    private onModelEvent(event: CommandEvent) {
        if (event.command === "window.configure") {
            return; // only a window's screen rect changed: nothing draws it
        }
        if (event.transient && this.applyTransient(event)) {
            return;
        }
        this.forgetRemoved();
        this.popoutManager?.sync();
        this.redraw();
    }

    private applyTransient(event: CommandEvent): boolean {
        if (event.command === "row.resize") {
            return this.applyTransientWeights(
                event.payload as { rowId: string; weights: number[] },
            );
        }
        if (event.command === "border.resize") {
            return this.measure.applyTransientBorderSize(
                event.payload as { borderId: string },
            );
        }
        return false;
    }

    private forgetRemoved() {
        const shared = this.shared;
        const isTab = (id: string) =>
            this.model.get("node-by", { id })?.type === "tab";
        for (const [id, element] of shared.moveables) {
            if (!isTab(id)) {
                shared.moveables.delete(id);
                element.remove();
            }
        }
        for (const id of shared.rendered) {
            if (!isTab(id)) {
                shared.rendered.delete(id);
                shared.scroll.delete(id);
            }
        }
        this.forgetNodesOutside();
        for (const { id } of this.derived.state().windows) {
            this.popoutManager?.getLayoutEngine(id)?.forgetNodesOutside();
        }
    }

    private forgetNodesOutside() {
        const gone = (id: string) =>
            this.model.get("layout-id-by", { nodeId: id }) !== this.layoutId;
        for (const key of this.measure.rects.keys()) {
            if (gone(key.slice(key.indexOf(":") + 1))) {
                this.measure.rects.delete(key);
            }
        }
        for (const map of [
            this.overflow.naturalTabSizes,
            this.overflow.reservedSpace,
        ]) {
            for (const id of map.keys()) {
                if (gone(id)) {
                    map.delete(id);
                }
            }
        }
    }

    private engineOf(id: string): LayoutEngine<T> {
        const layout = this.model.get("layout-id-by", { nodeId: id });
        if (layout === undefined || layout === MAIN_LAYOUT) {
            return this.main;
        }
        return this.main.popoutManager?.getLayoutEngine(layout) ?? this.main;
    }

    private applyTransientWeights(payload: {
        rowId: string;
        weights: number[];
    }): boolean {
        const row = this.model.get("node-by", { id: payload.rowId });
        if (row?.type !== "row") {
            return false;
        }
        const engine = this.engineOf(row.id);
        for (const [i, child] of row.children.entries()) {
            const weight = payload.weights[i];
            const element = engine.measure.measurables.get(
                `${child.type}:${child.id}`,
            )?.element;
            if (weight === undefined || !element) {
                return false; // not registered: fall back to the re-render path
            }
            element.style.flexGrow = String(flexGrow(weight));
        }
        engine.measure.applyMeasuredGeometry();
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

    private getDragDropManager(): DragDropManager {
        return this.dragDropManager;
    }

    private getTabDragSpeed(): number {
        return this.main.tabDragSpeed;
    }

    // *********************************************************************************
    // Popouts
    // *********************************************************************************

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

    // *********************************************************************************
    // Accessors
    // *********************************************************************************

    private isMainLayout(): boolean {
        return this.main === this;
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
