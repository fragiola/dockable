// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// and src/view/layout/LayoutInternal.tsx (the measure-and-position cycle, moveable element
// handling and the observers that drive them), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    DragDropManager,
    type IDropZoneOptions,
    type OnExternalDrag,
} from "../dnd/DragDropManager";
import type { DragGroup } from "../dnd/DragGroup";
import { type Action, Actions } from "../model/Actions";
import { BorderNode } from "../model/BorderNode";
import { DockLocation } from "../model/DockLocation";
import type { DropInfo } from "../model/DropInfo";
import type { ILayoutType } from "../model/IJsonModel";
import { Model, type ModelChangeListener } from "../model/Model";
import type { ModelLayout } from "../model/ModelLayout";
import type { Node } from "../model/Node";
import { type IRectLike, Rect } from "../model/Rect";
import { RowNode } from "../model/RowNode";
import type { TabGroupNode } from "../model/TabGroupNode";
import type { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { randomUUID } from "../model/Utils";
import { type IPopoutOptions, PopoutManager } from "../popout/PopoutManager";

/** The kinds of element whose geometry feeds the model. */
export type MeasurableKind =
    | "row"
    | "tabset"
    | "tabstrip"
    | "tabsetcontent"
    | "tabbutton"
    | "grouppill"
    | "groupendmarker"
    | "borderheader"
    | "bordercontent";

/** Measures an element in viewport coordinates. Defaults to `getBoundingClientRect`. */
export type MeasureFunction = (element: HTMLElement) => IRectLike;

/**
 * Intercepts every action dispatched through the engine. Return the action (or a replacement)
 * to apply it, or `undefined` to veto it.
 */
export type OnAction = (action: Action) => Action | undefined;

/** Called after the model applied an action. */
export type OnModelChange = (model: Model, action: Action) => void;

export interface ILayoutEngineOptions {
    model: Model;
    /** the layout this engine drives; defaults to the main layout */
    layoutId?: string;
    onAction?: OnAction;
    onModelChange?: OnModelChange;
    /** the main layout's engine, for engines of popout sub-layouts */
    mainEngine?: LayoutEngine;
    /** injectable element measurement (tests pass fixed rects) */
    measure?: MeasureFunction;
    /** true (default) to resize live while a splitter is dragged; false to preview and commit on release */
    realtimeResize?: boolean;
    /** seconds a view may take to animate the drop outline (exposed as data; default 0.3) */
    tabDragSpeed?: number;
    /** popout windows (main engine only) */
    popout?: IPopoutOptions;
    /** accepts foreign drags (files, links, other libraries) as new tabs (main engine only) */
    onExternalDrag?: OnExternalDrag;
    /**
     * decides whether a drag may drop at a target, like `model.setOnAllowDrop`, which it sets while
     * given (main engine only). Removing it restores the model's previous rule.
     */
    onAllowDrop?: OnAllowDrop;
    /**
     * a group of layouts of other models this layout exchanges tabs with by drag and drop (main
     * engine only). Without one, drags never cross models.
     */
    dragGroup?: DragGroup | undefined;
}

/** Whether `dragNode` may be dropped as `dropInfo` describes. */
export type OnAllowDrop = (dragNode: Node, dropInfo: DropInfo) => boolean;

/** Attribute that marks the element hosting a tab's content. */
export const MOVEABLE_ATTRIBUTE = "data-dockable-moveable";
/** Attribute that marks the hidden element parking moveables whose panel is gone. */
export const MOVEABLES_HOME_ATTRIBUTE = "data-dockable-moveables-home";
/** Attribute that marks a float window's container, used to measure float sub-layouts. */
export const FLOAT_ATTRIBUTE = "data-dockable-float";

const defaultMeasure: MeasureFunction = (element) =>
    element.getBoundingClientRect();

/**
 * The framework-agnostic layout engine for one {@link ModelLayout}. It implements the model's
 * layout-controller contract (`ILayoutController`), measures the elements an adapter registers and writes their rects
 * into the model, positions tab panels over their tabset's content area (structural style only),
 * owns the moveable elements that host tab content, dispatches actions through `onAction`, and
 * tells adapters when to re-render through a revision counter.
 *
 * The adapter's side of the cycle:
 * 1. call {@link prepare} before rendering a layout (computes paths and min/max sizes);
 * 2. render the structure, registering elements with {@link registerMeasurable},
 *    {@link registerTabPanel} and {@link registerSplitter};
 * 3. call {@link sync} after every commit (a layout effect in React);
 * 4. re-render when the revision from {@link subscribe}/{@link getSnapshot} changes.
 *
 * The engine never renders geometry through the adapter: panel positions are written directly,
 * so a resize or splitter drag does not require a re-render.
 */
export class LayoutEngine {
    // WeakMap so closed popout windows can be garbage collected
    private static windowIds: WeakMap<Window, string> = new WeakMap();

    private readonly model: Model;
    private readonly layoutId: string;
    private readonly mainEngine: LayoutEngine;
    private readonly measureElement: MeasureFunction;
    private onActionHandler: OnAction | undefined;
    private onModelChangeHandler: OnModelChange | undefined;
    private realtimeResize: boolean;
    private tabDragSpeed: number;
    private onExternalDragHandler: OnExternalDrag | undefined;
    private onAllowDropHandler: OnAllowDrop | undefined;
    private dragGroup: DragGroup | undefined;
    private leaveDragGroup: (() => void) | undefined;
    // the model's rule before this engine installed its own, restored when the option goes away
    private previousAllowDrop: OnAllowDrop | undefined;
    private readonly allowDrop: OnAllowDrop = (dragNode, dropInfo) =>
        this.onAllowDropHandler?.(dragNode, dropInfo) ?? true;
    private readonly dragDropManager: DragDropManager;
    private readonly popoutManager: PopoutManager | undefined;

    private layoutRef: HTMLElement | null = null;
    private moveablesHome: HTMLElement | null = null;
    private currentDocument: Document | undefined;
    private currentWindow: Window | undefined;
    private cachedLayoutDomRect: Rect | undefined;
    private reLayout = false;
    private lastRect: Rect = Rect.empty();
    // measurables: geometry measured into the model; tabPanels: positioned from those rects
    private readonly measurables: Map<
        string,
        { kind: MeasurableKind; node: Node; element: HTMLElement }
    > = new Map();
    private readonly tabPanels: Map<
        string,
        { node: TabNode; element: HTMLElement }
    > = new Map();
    private readonly splitters: Map<HTMLElement, () => boolean> = new Map();
    // watches the root and the measured elements so css-driven geometry changes (e.g. a font-size
    // or theme change altering the tabstrip height without resizing the layout root) re-measure
    private geometryResizeObserver: ResizeObserver | undefined;
    private healFrame: number | undefined;
    private splitterDragging = false;
    private revision = 0;
    private contentRevision = 0;
    private readonly listeners = new Set<() => void>();
    private readonly modelListener: ModelChangeListener = {
        onAfterAction: (action) => this.onModelChange(action),
    };
    private readonly teardown: (() => void)[] = [];

    /**
     * The engine driving `model`'s main layout, once a view has created it (e.g. a mounted
     * `Dockable.Root`). UI outside the layout (a sidebar of drag sources, a toolbar) uses it to
     * dispatch through `onAction` or to start a drag.
     */
    static of(model: Model): LayoutEngine | undefined {
        const controller = model.getMainLayout().getController();
        return controller instanceof LayoutEngine ? controller : undefined;
    }

    constructor(options: ILayoutEngineOptions) {
        this.model = options.model;
        this.layoutId = options.layoutId ?? Model.MAIN_LAYOUT_ID;
        this.mainEngine = options.mainEngine ?? this;
        this.measureElement = options.measure ?? defaultMeasure;
        this.onActionHandler = options.onAction;
        this.onModelChangeHandler = options.onModelChange;
        this.realtimeResize = options.realtimeResize ?? true;
        this.tabDragSpeed = options.tabDragSpeed ?? 0.3;
        this.onExternalDragHandler = options.onExternalDrag;
        this.dragDropManager = new DragDropManager(this);
        this.setOnAllowDrop(options.onAllowDrop);
        this.setDragGroup(options.dragGroup);
        if (this.mainEngine === this) {
            this.popoutManager = new PopoutManager(this);
            this.popoutManager.setOptions(options.popout ?? {});
        }
        this.getLayout().setController(this);
    }

    // *********************************************************************************
    // Adapter contract
    // *********************************************************************************

    /** Updates the callbacks and options an adapter passes on every render. */
    setOptions(
        options: Pick<
            ILayoutEngineOptions,
            | "onAction"
            | "onModelChange"
            | "realtimeResize"
            | "tabDragSpeed"
            | "popout"
            | "onExternalDrag"
            | "onAllowDrop"
            | "dragGroup"
        >,
    ) {
        this.setOnAllowDrop(options.onAllowDrop);
        this.setDragGroup(options.dragGroup);
        this.popoutManager?.setOptions(options.popout ?? {});
        this.onActionHandler = options.onAction;
        this.onModelChangeHandler = options.onModelChange;
        this.realtimeResize = options.realtimeResize ?? true;
        this.tabDragSpeed = options.tabDragSpeed ?? 0.3;
        this.onExternalDragHandler = options.onExternalDrag;
    }

    /**
     * Installs (or removes) the engine's drop rule on the model. Only the main engine does: popout
     * layouts share the model and its rule.
     */
    private setOnAllowDrop(handler: OnAllowDrop | undefined) {
        if (this.mainEngine !== this) {
            return;
        }
        const installed = this.model.getOnAllowDrop() === this.allowDrop;
        if (handler) {
            if (!installed) {
                this.previousAllowDrop = this.model.getOnAllowDrop();
                this.model.setOnAllowDrop(this.allowDrop);
            }
        } else if (installed) {
            this.model.setOnAllowDrop(this.previousAllowDrop);
            this.previousAllowDrop = undefined;
        }
        this.onAllowDropHandler = handler;
    }

    /** Joins (or leaves) a drag group. Only the main engine joins: popouts share its model. */
    private setDragGroup(group: DragGroup | undefined) {
        if (this.mainEngine !== this || group === this.dragGroup) {
            return;
        }
        this.leaveDragGroup?.();
        this.dragGroup = group;
        this.leaveDragGroup = group?.join(this);
    }

    /** The drag group this layout exchanges tabs in (the main engine's), if any. */
    getDragGroup(): DragGroup | undefined {
        return this.mainEngine.dragGroup;
    }

    /**
     * Makes `element` a drop zone for this model's drags: while a drag the zone accepts is over it,
     * the layouts show no outline, and a drop calls `options.onDrop` with the dragged node instead
     * of moving anything. The element can be anywhere in the document, inside or outside a layout
     * root. Returns the function that unregisters it.
     */
    registerDropZone(element: Element, options: IDropZoneOptions): () => void {
        return DragDropManager.registerDropZone(this.model, element, options);
    }

    /** The handler that accepts foreign drags (set on the main engine). */
    getOnExternalDrag(): OnExternalDrag | undefined {
        return this.onExternalDragHandler;
    }

    /** Calls `listener` when adapters should re-render. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        if (this.mainEngine !== this) {
            return this.mainEngine.subscribe(listener);
        }
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** The render revision: a number that changes whenever adapters should re-render. */
    getSnapshot = (): number => {
        return this.mainEngine === this
            ? this.revision
            : this.mainEngine.getSnapshot();
    };

    /** A revision that only changes when tab content should re-render too. */
    getContentRevision(): number {
        return this.mainEngine === this
            ? this.contentRevision
            : this.mainEngine.getContentRevision();
    }

    /**
     * Prepares the layout for rendering: computes the `data-layout-path` of every node and the
     * min/max sizes rows and tabsets are rendered with. Call before rendering the layout.
     */
    prepare(path = "") {
        const rootRow = this.model.getRootRow(this.layoutId);
        if (!rootRow) {
            return;
        }
        // the adapter may have created (and discarded) other engines for this layout, e.g. under
        // React StrictMode: the engine that renders is the model's controller
        this.getLayout().setController(this);
        this.cachedLayoutDomRect = undefined;
        rootRow.calcMinMaxSize();
        rootRow.setPaths(path);
        if (this.isMainLayout()) {
            this.model.getBorderSet().setPaths();
        }
    }

    /**
     * Attaches the layout's root element: the containing block the panels are positioned in.
     * Starts observing it and the window it lives in. Idempotent; attaching another element
     * detaches the previous one first.
     */
    attachRoot(element: HTMLElement) {
        if (this.layoutRef === element && this.teardown.length > 0) {
            return;
        }
        this.detachRoot();
        this.layoutRef = element;
        const doc = element.ownerDocument;
        const win = doc.defaultView ?? undefined;
        this.setCurrentWindow(doc, win);

        this.getLayout().setController(this);

        if (this.isMainLayout()) {
            // reuse a home left behind by a previous engine of the same root (a model swap keeps
            // the parked moveables, whose content is still rendered into them)
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
            this.moveablesHome = home;
            this.teardown.push(() => {
                // keep parked content alive: its React portal still points at the moveable
                if (home.childNodes.length === 0) {
                    home.remove();
                }
                if (this.moveablesHome === home) {
                    this.moveablesHome = null;
                }
            });
        }

        const layout = this.getLayout();
        layout.setToExportRectFunction((r: Rect, type: ILayoutType) =>
            type === "window" ? this.getScreenRect(r) : this.getRelativeRect(r),
        );

        if (this.isMainLayout()) {
            this.model.addChangeListener(this.modelListener);
            this.teardown.push(() =>
                this.model.removeChangeListener(this.modelListener),
            );
        }

        // native drag listeners on the root (not framework events), so the same code path works
        // when the root lives in a popout document
        const dnd = this.dragDropManager;
        const onDragEnter = (event: DragEvent) => dnd.onDragEnterRaw(event);
        const onDragLeave = (event: DragEvent) => dnd.onDragLeaveRaw(event);
        const onDragOver = (event: DragEvent) => dnd.onDragOver(event);
        const onDrop = (event: DragEvent) => dnd.onDrop(event);
        element.addEventListener("dragenter", onDragEnter);
        element.addEventListener("dragleave", onDragLeave);
        element.addEventListener("dragover", onDragOver);
        element.addEventListener("drop", onDrop);
        this.teardown.push(() => {
            element.removeEventListener("dragenter", onDragEnter);
            element.removeEventListener("dragleave", onDragLeave);
            element.removeEventListener("dragover", onDragOver);
            element.removeEventListener("drop", onDrop);
            dnd.clearDragLocal();
        });

        if (win) {
            // re-measure before paint to keep panels in sync with flex-resized rows
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
                // a hidden page may have skipped measure passes: redraw every layout when it shows
                const visibilityChange = () => this.redrawLayout();
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
        this.popoutManager?.openPending();
    }

    /** Detaches the root element and releases every observer and listener. */
    detachRoot() {
        this.cancelHeal();
        while (this.teardown.length > 0) {
            this.teardown.pop()?.();
        }
        this.layoutRef = null;
        this.cachedLayoutDomRect = undefined;
    }

    /** Detaches and forgets everything. The engine must not be used afterwards. */
    dispose() {
        this.setOnAllowDrop(undefined);
        this.setDragGroup(undefined);
        this.detachRoot();
        this.dragDropManager.dispose();
        this.popoutManager?.dispose();
        this.measurables.clear();
        this.tabPanels.clear();
        this.splitters.clear();
        this.listeners.clear();
        const layout = this.model.getLayouts().get(this.layoutId);
        if (layout?.getController() === this) {
            layout.setController(undefined);
        }
    }

    /**
     * Runs the measure-and-position cycle: measures every registered element into the model,
     * positions the tab panels and discovers the splitter size. Call after every commit.
     */
    sync() {
        const changed = this.applyMeasuredGeometry();
        if (changed) {
            // post-paint heal: re-measure after css settles (fonts, transitions) to fix jitter
            this.scheduleHeal();
        }
    }

    // *********************************************************************************
    // Registration
    // *********************************************************************************

    /** Registers (or, with `null`, unregisters) an element whose geometry feeds the model. */
    registerMeasurable(
        node: Node,
        kind: MeasurableKind,
        element: HTMLElement | null,
    ) {
        const key = `${kind}:${node.getId()}`;
        const prev = this.measurables.get(key);
        if (element) {
            this.measurables.set(key, { kind, node, element });
        } else {
            this.measurables.delete(key);
            // an unmounted group element must not leave a stale rect behind (e.g. the split pill's
            // end marker disappears when the model switches to the underline tab group type), or
            // the group's line geometry keeps hit-testing at the ghost position
            if (kind === "grouppill") {
                (node as TabGroupNode).setPillRect(Rect.empty());
            } else if (kind === "groupendmarker") {
                (node as TabGroupNode).setEndMarkerRect(Rect.empty());
            }
        }
        // css-driven geometry changes (e.g. a font-size or theme change) do not resize the layout
        // root, so also watch the measured elements and re-measure when they resize; tab buttons are
        // excluded since their overflow is handled separately
        if (kind !== "tabbutton" && prev?.element !== element) {
            if (prev) {
                this.geometryResizeObserver?.unobserve(prev.element);
            }
            if (element) {
                this.geometryResizeObserver?.observe(element);
            }
        }
    }

    /** Registers (or unregisters) the element a tab's content panel is positioned with. */
    registerTabPanel(node: TabNode, element: HTMLElement | null) {
        if (element) {
            this.tabPanels.set(node.getId(), { node, element });
        } else {
            this.tabPanels.delete(node.getId());
        }
    }

    /**
     * Registers (or unregisters) a splitter element. Its thickness (width while `isHorizontal()`,
     * i.e. the splitter sits between side by side children; height otherwise) becomes the model's
     * splitter size. The orientation is read at every measure pass, since a row can flip it.
     */
    registerSplitter(
        element: HTMLElement,
        isHorizontal: () => boolean,
        register = true,
    ) {
        const main = this.mainEngine;
        if (register) {
            if (!main.splitters.has(element)) {
                this.geometryResizeObserver?.observe(element);
            }
            main.splitters.set(element, isHorizontal);
        } else if (main.splitters.delete(element)) {
            this.geometryResizeObserver?.unobserve(element);
        }
    }

    /** @internal the measured and positioned elements (tests and debugging) */
    getRegistrations() {
        return {
            measurables: this.measurables,
            tabPanels: this.tabPanels,
            splitters: this.mainEngine.splitters,
        };
    }

    // *********************************************************************************
    // Measure and position
    // *********************************************************************************

    /** batch-measure all registered elements and write rects into the model; returns true on change */
    syncLayoutMetrics(): boolean {
        // invalidate cached origin (page may scroll between passes); per-pass caching is preserved
        this.cachedLayoutDomRect = undefined;
        let changed = false;
        for (const { kind, node, element } of this.measurables.values()) {
            if (!element.isConnected) {
                continue;
            }
            const rect = this.getBoundingClientRect(element);
            switch (kind) {
                case "row":
                case "tabset":
                    if (!rect.equalsWhenRounded(node.getRect())) {
                        (node as RowNode | TabSetNode).setRect(rect);
                        changed = true;
                    }
                    break;
                case "tabstrip":
                    if (
                        !rect.equalsWhenRounded(
                            (node as TabSetNode).getTabStripRect(),
                        )
                    ) {
                        (node as TabSetNode).setTabStripRect(rect);
                        changed = true;
                    }
                    break;
                case "tabsetcontent": {
                    const tabsetNode = node as TabSetNode;
                    if (
                        !Number.isNaN(rect.x) &&
                        !tabsetNode.getContentRect().equalsWhenRounded(rect)
                    ) {
                        const hadSize =
                            tabsetNode.getContentRect().width > 0 &&
                            tabsetNode.getContentRect().height > 0;
                        tabsetNode.setContentRect(rect);
                        changed = true;
                        if (!hadSize && rect.width > 0 && rect.height > 0) {
                            // the tab content render is gated on a non empty rect, so the first time a
                            // content area gains a size a re-render is needed to mount the content;
                            // recurring geometry changes are applied imperatively in positionTabPanels
                            this.reLayout = true;
                        }
                    }
                    break;
                }
                case "tabbutton":
                    if (
                        !rect.equalsWhenRounded((node as TabNode).getTabRect())
                    ) {
                        (node as TabNode).setTabRect(rect);
                        changed = true;
                    }
                    break;
                case "grouppill":
                    if (
                        !rect.equalsWhenRounded(
                            (node as TabGroupNode).getPillRect(),
                        )
                    ) {
                        (node as TabGroupNode).setPillRect(rect);
                        changed = true;
                    }
                    break;
                case "groupendmarker":
                    if (
                        !rect.equalsWhenRounded(
                            (node as TabGroupNode).getEndMarkerRect(),
                        )
                    ) {
                        (node as TabGroupNode).setEndMarkerRect(rect);
                        changed = true;
                    }
                    break;
                case "borderheader":
                    // note: BorderNode.getRect() returns the tab header rect
                    if (
                        !rect.equalsWhenRounded((node as BorderNode).getRect())
                    ) {
                        (node as BorderNode).setTabHeaderRect(rect);
                        changed = true;
                    }
                    break;
                case "bordercontent": {
                    const borderNode = node as BorderNode;
                    if (
                        !Number.isNaN(rect.x) &&
                        rect.width > 0 &&
                        !borderNode.getContentRect().equalsWhenRounded(rect)
                    ) {
                        const hadSize =
                            borderNode.getContentRect().width > 0 &&
                            borderNode.getContentRect().height > 0;
                        borderNode.setContentRect(rect);
                        changed = true;
                        if (!hadSize && rect.height > 0) {
                            this.reLayout = true;
                        }
                    }
                    break;
                }
            }
        }
        // a group's drop region spans its pill plus (when open) its tabs, which are measured in
        // the same pass above, so reconcile each group's rect after all child rects are current
        for (const { kind, node } of this.measurables.values()) {
            if (kind === "grouppill") {
                const group = node as TabGroupNode;
                const region = group.getDropRegion();
                if (!region.equalsWhenRounded(group.getRect())) {
                    group.setRect(region);
                    changed = true;
                }
            }
        }
        return changed;
    }

    /**
     * Positions the tab panels over their parent's content area and sets their visibility. Writes
     * only structural style: `position`, `left`, `top`, `width`, `height` and `display`.
     */
    positionTabPanels() {
        for (const { node, element } of this.tabPanels.values()) {
            if (!node.getParent()) {
                continue; // the tab left the tree (it is being deleted)
            }
            const rect = node.getTabContainer().getContentRect();
            const visible = isTabPanelVisible(node);

            rect.positionElement(element);
            element.style.display = visible ? "" : "none";

            node.setRect(rect); // fires the resize event to user code when changed
            node.setVisible(visible); // fires the visibility event to user code when changed
        }
    }

    /** measures the splitter thickness and feeds it to the model; returns true on change */
    private syncSplitterSize(): boolean {
        for (const [element, isHorizontal] of this.mainEngine.splitters) {
            if (!element.isConnected) {
                continue;
            }
            const r = this.measureElement(element);
            const size = isHorizontal() ? r.width : r.height;
            if (size <= 0) {
                continue; // hidden (e.g. while a tabset is maximized)
            }
            if (Math.abs(size - (this.model.getSplitterSize() ?? 0)) > 0.5) {
                this.model.setSplitterSize(size);
                return true;
            }
            return false;
        }
        return false;
    }

    // re-measure, reposition panels, and mount any newly sized content areas
    private applyMeasuredGeometry(): boolean {
        const changed = this.syncLayoutMetrics();
        this.positionTabPanels();
        const splitterSizeChanged = this.syncSplitterSize();
        if (splitterSizeChanged || this.reLayout) {
            this.reLayout = false;
            this.redrawLayout();
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

    /** sets the ResizeObserver that watches the measured elements; observes any already
     *  registered elements (e.g. those registered before this observer was created) */
    private setGeometryResizeObserver(observer: ResizeObserver | undefined) {
        this.geometryResizeObserver = observer;
        if (observer) {
            for (const { kind, element } of this.measurables.values()) {
                if (kind !== "tabbutton") {
                    observer.observe(element);
                }
            }
            for (const element of this.mainEngine.splitters.keys()) {
                observer.observe(element);
            }
        }
    }

    /** re-measures the layout root; a changed size relayouts */
    updateRect = () => {
        let element = this.layoutRef;
        if (!element) {
            return;
        }
        const layout = this.getLayout();
        const isFloat = !layout.isMainLayout() && layout.getType() === "float";
        if (isFloat) {
            const floatWindow = element.closest<HTMLElement>(
                `[${FLOAT_ATTRIBUTE}]`,
            );
            if (floatWindow) {
                element = floatWindow;
            }
        }

        let rect = Rect.fromDomRect(this.measureElement(element));
        if (isFloat) {
            rect = rect.relativeTo(this.mainEngine.getDomRect());
        }

        if (
            !rect.equalsWhenRounded(this.lastRect) &&
            rect.width !== 0 &&
            rect.height !== 0
        ) {
            this.lastRect = rect;
            layout.setRect(rect);
            this.redrawLayout();
        }
    };

    // *********************************************************************************
    // Actions and model changes
    // *********************************************************************************

    /** Dispatches an action through `onAction`, which may replace or veto it. */
    doAction(action: Action): Node | undefined {
        const outcome = this.interceptAction(action);
        return outcome !== undefined ? this.model.doAction(outcome) : undefined;
    }

    /**
     * Runs `onAction` on an action without applying it: returns the action to apply (the same one,
     * or the handler's replacement), or `undefined` when the handler vetoed it. `doAction` is
     * `interceptAction` followed by `model.doAction`.
     */
    interceptAction(action: Action): Action | undefined {
        const onAction = this.mainEngine.onActionHandler;
        return onAction !== undefined ? onAction(action) : action;
    }

    private onModelChange(action: Action) {
        if (
            action.isAdjusting() &&
            (action.type === Actions.ADJUST_WEIGHTS ||
                action.type === Actions.ADJUST_BORDER_SPLIT)
        ) {
            if (action.type === Actions.ADJUST_WEIGHTS) {
                this.applyAdjustingWeights(action);
            } else {
                this.applyAdjustingBorderSplit(action);
            }
            this.onModelChangeHandler?.(this.model, action);
            return;
        }

        this.redrawLayout();
        this.onModelChangeHandler?.(this.model, action);
    }

    /** the engine that owns the node's layout (sub-layout rows are registered there) */
    private engineFor(node: Node): LayoutEngine {
        const controller = node.getLayout().getController();
        return controller instanceof LayoutEngine ? controller : this;
    }

    private applyAdjustingWeights(action: Action) {
        const row = this.model.getNodeById(action.data.nodeId);
        if (!(row instanceof RowNode)) {
            this.redrawLayout();
            return;
        }
        const engine = this.engineFor(row);
        const weights = action.data.weights as number[] | undefined;
        const children = row.getChildren();
        for (const [i, child] of children.entries()) {
            const weight = weights?.[i];
            // the same guard as Model.applyAdjustWeights: a weight the model ignores must not be
            // previewed either
            if (
                typeof weight !== "number" ||
                !Number.isFinite(weight) ||
                weight <= 0
            ) {
                continue;
            }
            const kind: MeasurableKind =
                child instanceof RowNode ? "row" : "tabset";
            const element = engine.measurables.get(
                `${kind}:${child.getId()}`,
            )?.element;
            if (!element) {
                // not registered: fall back to the re-render path
                this.redrawLayout();
                return;
            }
            // NOTE: flex-grow cannot have values < 1 otherwise it will not fill the parent
            element.style.flexGrow = String(Math.max(1, weight * 1000));
        }

        engine.applyMeasuredGeometry();
    }

    private applyAdjustingBorderSplit(action: Action) {
        const borderNode = this.model.getNodeById(action.data.node);
        if (!(borderNode instanceof BorderNode) || borderNode.isOverlay()) {
            // overlay borders need a full re-render (their position depends on other open borders)
            this.redrawLayout();
            return;
        }

        const element = this.measurables.get(
            `bordercontent:${borderNode.getId()}`,
        )?.element;
        if (!element) {
            this.redrawLayout();
            return;
        }

        const size = borderNode.getSize();
        if (borderNode.isHorizontal()) {
            element.style.width = `${size}px`;
            element.style.minWidth = `${borderNode.getMinSize()}px`;
            element.style.maxWidth = `${borderNode.getMaxSize()}px`;
        } else {
            element.style.height = `${size}px`;
            element.style.minHeight = `${borderNode.getMinSize()}px`;
            element.style.maxHeight = `${borderNode.getMaxSize()}px`;
        }

        this.applyMeasuredGeometry();
    }

    /** asks adapters to re-render the layout structure */
    redrawLayout() {
        const main = this.mainEngine;
        main.revision++;
        for (const listener of [...main.listeners]) {
            listener();
        }
    }

    /** asks adapters to re-render the layout structure and the tab content */
    redrawLayoutAndTabContent() {
        this.mainEngine.contentRevision++;
        this.redrawLayout();
    }

    // *********************************************************************************
    // Moveable elements
    // *********************************************************************************

    /**
     * Creates the element that hosts a tab's content: `<div data-dockable-moveable>` in the main
     * layout's document, with structural sizing only. Called by the model, lazily.
     */
    createMoveableElement(): HTMLElement {
        const main = this.mainEngine;
        const doc =
            main.currentDocument ??
            main.layoutRef?.ownerDocument ??
            this.layoutRef?.ownerDocument;
        if (!doc) {
            throw new Error(
                "LayoutEngine.createMoveableElement: attach a root element first",
            );
        }
        const element = doc.createElement("div");
        element.setAttribute(MOVEABLE_ATTRIBUTE, "");
        element.style.width = "100%";
        element.style.height = "100%";
        return element;
    }

    /** The element hosting the tab's content, created on first use. */
    getMoveableElement(tab: TabNode): HTMLElement {
        return tab.getMoveableElement();
    }

    /**
     * Moves the tab's moveable element into `panel` (its current container). The same element is
     * re-parented, never cloned, so content state survives moves between panels and documents.
     */
    attachMoveable(tab: TabNode, panel: HTMLElement) {
        const element = tab.getMoveableElement();
        element.style.overflow = tab.isEnableScrollbars() ? "auto" : "hidden";
        if (element.parentElement !== panel) {
            // appendChild adopts the node into the panel's document; identity is what preserves
            // the content's state, so the element is never imported or cloned
            panel.appendChild(element);
            tab.restoreScrollPosition();
        }
        // keep the scroll position, so it can be restored after a move. One listener per element
        // for its whole life: the element outlives engines (and models, through Model.fromJson's
        // view state adoption), so the listener reads the element's current tab
        const scroll = scrollTracking.get(element);
        if (scroll) {
            scroll.tab = tab;
        } else {
            const tracking = { tab };
            element.addEventListener("scroll", () =>
                tracking.tab.saveScrollPosition(),
            );
            scrollTracking.set(element, tracking);
        }
    }

    /**
     * Parks the tab's moveable element in the hidden moveables home when its panel goes away, so
     * the content's DOM (and the framework state rendered into it) is never destroyed by
     * unmounting a panel. A later {@link attachMoveable} moves the same element into a new panel.
     */
    releaseMoveable(tab: TabNode, panel?: HTMLElement) {
        const element = tab.getMoveableElement();
        if (panel !== undefined && element.parentElement !== panel) {
            return; // already attached elsewhere
        }
        const home = this.mainEngine.moveablesHome;
        if (
            home &&
            this.model.getNodeById(tab.getId()) &&
            !tab.isEnableWindowReMount()
        ) {
            home.appendChild(element); // keep element parented, so it stays in the document
        }
        tab.setVisible(false);
    }

    /** the hidden element moveables are parked in (main layout only) */
    getMoveablesHome(): HTMLElement | null {
        return this.mainEngine.moveablesHome;
    }

    // *********************************************************************************
    // Keyboard focus
    // *********************************************************************************

    /**
     * Moves focus to the selected tab button of the next/previous tabset in this layout
     * (wrapping), starting from the tabset containing focus (its strip or its selected tab's
     * panel) and falling back to the active tabset; the target also becomes the active tabset.
     * Returns true when focus moved.
     */
    focusAdjacentTabset(delta: number): boolean {
        const doc = this.currentDocument;
        const active = doc?.activeElement;
        if (!doc || !active || !this.layoutRef?.contains(active)) {
            return false;
        }
        // leave text editing contexts alone (inputs and editors in tab content, where modified
        // arrow keys typically navigate within the text)
        const tag = active.tagName;
        if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            (active as HTMLElement).isContentEditable ||
            active.closest('[role="menu"]')
        ) {
            return false;
        }
        if (this.model.getMaximizedTabset(this.layoutId) !== undefined) {
            return false; // only the maximized tabset is visible
        }
        const tabsets: TabSetNode[] = [];
        this.model.visitLayoutNodes(this.layoutId, (node) => {
            if (
                node instanceof TabSetNode &&
                node.getSelectedNode() !== undefined
            ) {
                tabsets.push(node);
            }
        });
        if (tabsets.length < 2) {
            return false;
        }
        const containsFocus = (tabset: TabSetNode) => {
            if (
                this.measurables
                    .get(`tabset:${tabset.getId()}`)
                    ?.element.contains(active)
            ) {
                return true; // focus in the tabstrip
            }
            const selected = tabset.getSelectedNode();
            return (
                !!selected &&
                !!this.tabPanels.get(selected.getId())?.element.contains(active)
            );
        };
        let index = tabsets.findIndex(containsFocus);
        if (index === -1) {
            const activeTabset = this.model.getActiveTabset(this.layoutId);
            index =
                activeTabset !== undefined ? tabsets.indexOf(activeTabset) : 0;
            if (index === -1) {
                index = 0;
            }
        }
        const target =
            tabsets[(index + delta + tabsets.length) % tabsets.length];
        const selected = target?.getSelectedNode();
        if (!target || !selected) {
            return false;
        }
        this.measurables.get(`tabbutton:${selected.getId()}`)?.element.focus();
        this.doAction(Actions.setActiveTabset(target.getId(), this.layoutId));
        return true;
    }

    // *********************************************************************************
    // Splitter state
    // *********************************************************************************

    isRealtimeResize() {
        return this.mainEngine.realtimeResize;
    }

    /** true while any splitter of the model is being dragged */
    isSplitterDragging() {
        return this.mainEngine.splitterDragging;
    }

    setSplitterDragging(dragging: boolean) {
        this.mainEngine.splitterDragging = dragging;
    }

    // *********************************************************************************
    // Geometry
    // *********************************************************************************

    /** an element's rect relative to the layout root */
    getBoundingClientRect(element: HTMLElement): Rect {
        const layoutRect = this.getDomRect();
        return Rect.fromDomRect(this.measureElement(element)).relativeTo(
            layoutRect,
        );
    }

    /** the layout root's rect in viewport coordinates */
    /** the layout root's rect in viewport coordinates, measured now (not the per-pass cache) */
    getFreshDomRect(): Rect {
        this.cachedLayoutDomRect = undefined;
        return this.getDomRect();
    }

    /** the popout windows of the model (owned by the main engine) */
    getPopoutManager(): PopoutManager {
        const manager = this.mainEngine.popoutManager;
        if (!manager) {
            throw new Error(
                "LayoutEngine: the main engine has no popout manager",
            );
        }
        return manager;
    }

    /** whether window layouts open as native popouts */
    isSupportsPopout(): boolean {
        return this.getPopoutManager().isSupportsPopout();
    }

    /** Whether `node` lives in a popout window's layout. */
    isInWindow(node: TabNode | TabSetNode): boolean {
        const layoutId = node.getLayoutId();
        // the main layout reports the "window" type too: it is the main window's layout
        return (
            layoutId !== Model.MAIN_LAYOUT_ID &&
            this.model.getLayouts().get(layoutId)?.getType() === "window"
        );
    }

    /**
     * Whether `node` (a tab, or a whole tabset) can be popped out into a window now: popouts are
     * supported, it is not in a window already, and it (every tab of it) enables popout.
     */
    canPopout(node: TabNode | TabSetNode): boolean {
        if (!this.isSupportsPopout() || this.isInWindow(node)) {
            return false;
        }
        if (node instanceof TabSetNode) {
            return node.getChildren().length > 0 && node.isAllowedInWindow();
        }
        return node.isAllowedInWindow();
    }

    /** Pops `node` (a tab, or a whole tabset) out into a window, through `onAction`. */
    popout(node: TabNode | TabSetNode): Node | undefined {
        return this.doAction(
            node instanceof TabSetNode
                ? Actions.popoutTabset(node.getId(), "window")
                : Actions.popoutTab(node.getId(), "window"),
        );
    }

    /**
     * Moves `node` (a tab, or every tab of a tabset) from a window back into the main layout: into
     * its active tabset, else its first one, else a new tabset. Emptying a window closes it.
     */
    dockBack(node: TabNode | TabSetNode): Node | undefined {
        const tabs = node instanceof TabSetNode ? node.getChildren() : [node];
        return dockTabs(
            this,
            tabs.map((tab) => tab.getId()),
        );
    }

    /** the drag-and-drop state machine of this layout */
    getDragDropManager(): DragDropManager {
        return this.dragDropManager;
    }

    /** seconds a view may take to animate the drop outline */
    getTabDragSpeed(): number {
        return this.mainEngine.tabDragSpeed;
    }

    getDomRect(): Rect {
        if (this.cachedLayoutDomRect !== undefined) {
            return this.cachedLayoutDomRect;
        }
        // get fresh rect on demand (page may have scrolled)
        if (this.layoutRef) {
            this.cachedLayoutDomRect = Rect.fromDomRect(
                this.measureElement(this.layoutRef),
            );
            return this.cachedLayoutDomRect;
        }
        return Rect.empty();
    }

    /** a layout-relative rect in screen coordinates (for opening popout windows) */
    getScreenRect(inRect: Rect): Rect {
        const rect = inRect.clone();
        const win = this.currentWindow;
        if (!win) {
            return rect;
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
        rect.x =
            win.screenX + win.scrollX + navWidth / 2 + layoutRect.x + rect.x;
        rect.y =
            win.screenY +
            win.scrollY +
            (navHeight - navWidth / 2) +
            layoutRect.y +
            rect.y;
        rect.height += navHeight;
        rect.width += navWidth;
        return rect;
    }

    /** a sub-layout-relative rect relative to the main layout */
    getRelativeRect(inRect: Rect): Rect {
        const rect = inRect.clone();
        const layout = this.getLayout();
        if (!layout.isMainLayout()) {
            const layoutRect = layout.getRect();
            rect.x += layoutRect.x;
            rect.y += layoutRect.y;
        }
        return rect;
    }

    // *********************************************************************************
    // ILayoutController and accessors
    // *********************************************************************************

    getModel(): Model {
        return this.model;
    }

    getLayoutId(): string {
        return this.layoutId;
    }

    getLayout(): ModelLayout {
        const layout = this.model.getLayouts().get(this.layoutId);
        if (!layout) {
            throw new Error(
                `LayoutEngine: the model has no layout "${this.layoutId}"`,
            );
        }
        return layout;
    }

    isMainLayout(): boolean {
        return this.mainEngine === this;
    }

    getMainEngine(): LayoutEngine {
        return this.mainEngine;
    }

    getLayoutRef(): HTMLElement | null {
        return this.layoutRef;
    }

    getCurrentDocument(): Document | undefined {
        return this.currentDocument;
    }

    getCurrentWindow(): Window | undefined {
        return this.currentWindow;
    }

    getWindowId(): string | undefined {
        return this.currentWindow
            ? LayoutEngine.windowIds.get(this.currentWindow)
            : undefined;
    }

    private setCurrentWindow(doc: Document, win: Window | undefined) {
        this.currentDocument = doc;
        this.currentWindow = win;
        if (win && !LayoutEngine.windowIds.has(win)) {
            LayoutEngine.windowIds.set(win, randomUUID());
        }
    }
}

/**
 * Whether a tab's panel is shown: the tab is selected, and neither hidden by another tabset of its
 * layout being maximized nor by its border being hidden. Adapters use it for their visibility
 * state, so it always matches what the engine displays.
 */
export function isTabPanelVisible(tab: TabNode): boolean {
    if (!tab.getParent() || !tab.isSelected()) {
        return false;
    }
    const container = tab.getTabContainer();
    if (container instanceof TabSetNode) {
        const maximized = tab
            .getModel()
            .getMaximizedTabset(container.getLayoutId());
        return maximized === undefined || container.isMaximized();
    }
    return !(container instanceof BorderNode) || container.isShowing();
}

/** the scroll listener installed on each moveable element, and the tab it currently hosts */
const scrollTracking = new WeakMap<HTMLElement, { tab: TabNode }>();

/** Creates a {@link LayoutEngine} for a layout of `model` (the main layout by default). */
export function createLayoutEngine(
    options: ILayoutEngineOptions,
): LayoutEngine {
    return new LayoutEngine(options);
}

/**
 * Moves the tabs `tabIds` into the main layout's dock target ({@link dockTargetOf}), as one
 * (grouped) action through `onAction`.
 */
export function dockTabs(
    engine: LayoutEngine,
    tabIds: readonly string[],
): Node | undefined {
    const target = dockTargetOf(engine.getModel());
    const moves = tabIds.map((id) =>
        Actions.moveNode(id, target.getId(), DockLocation.CENTER, -1),
    );
    if (moves.length === 0) {
        return undefined;
    }
    return engine.doAction(
        moves.length === 1 && moves[0] ? moves[0] : Actions.group(moves),
    );
}

/** Where tabs docked back from a window go: the main layout's active tabset, else its first. The
 * model always keeps a tabset in the main layout, so the root row is only a type-level fallback. */
export function dockTargetOf(model: Model): TabSetNode | RowNode {
    const active = model.getActiveTabset(Model.MAIN_LAYOUT_ID);
    if (active) {
        return active;
    }
    let first: TabSetNode | undefined;
    model.visitLayoutNodes(Model.MAIN_LAYOUT_ID, (node) => {
        if (!first && node instanceof TabSetNode) {
            first = node;
        }
    });
    return first ?? (model.getRootRow() as RowNode);
}
