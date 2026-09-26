// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/DragDropManager.tsx,
// with React, JSX and class names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see
// LICENSE.
//
// Differences from FlexLayout:
// - the drop outline is not a classed div the manager creates and positions: the manager exposes
//   a subscribable indicator state that a view renders (`Dockable.DropIndicator`);
// - the drag image is an element the adapter provides (no React root rendered at dragstart, no
//   generated text);
// - "add" drags (a consumer element dragged in, `addTabWithDragAndDrop`) and external drags (a
//   foreign drag accepted by `onExternalDrag`) drop through `Actions.addTab`, interceptable by
//   `onAction`; the drop callback receives the new tab, or `undefined` when the action was vetoed.
//   An external drag also ends when it leaves every layout (its source is outside the page, so no
//   `dragend` reaches the document);
// - the indicator state also names the targeted tabset (`targetTabSetId`, `index` for strip drops)
//   and reports a target that a drop rule refused (`refused`, `refusedTabSetId`), hiding the
//   outline instead of leaving the last accepted one on screen;
// - drop zones: consumer elements registered with `registerDropZone` take a layout drag and hand
//   the dragged node to the consumer (FlexLayout has no equivalent);
// - the overlay border reveal during a drag is not ported (borders slice).
import type { LayoutEngine } from "../engine/LayoutEngine";
import { Actions } from "../model/Actions";
import { BorderNode } from "../model/BorderNode";
import { DockLocation } from "../model/DockLocation";
import type { DropInfo, DropKind } from "../model/DropInfo";
import type { IDraggable } from "../model/IDraggable";
import type { IJsonTabNode } from "../model/IJsonModel";
import type { Model } from "../model/Model";
import type { ModelLayout } from "../model/ModelLayout";
import type { Node } from "../model/Node";
import { Orientation } from "../model/Orientation";
import { Rect } from "../model/Rect";
import { RowNode } from "../model/RowNode";
import { TabGroupNode } from "../model/TabGroupNode";
import { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { enablePointerOnIFrames } from "../splitter/SplitterController";

/** The `text/plain` payload that marks a drag started by a dockable layout. */
export const DRAG_MARKER = "--dockable--";

/** The drop location names, as `DockLocation.getName()` returns them. */
export type DropLocation = "center" | "top" | "bottom" | "left" | "right";

/** What a drop indicator shows. The same object is returned until it changes. */
export interface IDropIndicatorState {
    /** a drop target is under the pointer */
    readonly visible: boolean;
    /** the drop outline, relative to the layout root (1x1 at the pointer when a drag enters) */
    readonly rect: Rect;
    /** where the dragged node would dock relative to the target */
    readonly location: DropLocation;
    /** `"edge"` for a drop at the outer edge of a row, `"rect"` otherwise */
    readonly kind: DropKind;
    /** a drag is over this layout */
    readonly dragging: boolean;
    /** the id of the dragged node */
    readonly dragNodeId: string | undefined;
    /** edge docking is enabled (and no tabset is maximized): edge affordances may be shown */
    readonly showEdges: boolean;
    /** seconds a view may take to animate the outline between targets (the core never animates) */
    readonly tabDragSpeed: number;
    /** the id of the drop target node (a tabset, a row for edge drops, a border, a tab group) */
    readonly targetNodeId: string | undefined;
    /** the id of the tabset (or border) the drop goes into or beside (also for strip and group drops) */
    readonly targetTabSetId: string | undefined;
    /** the insertion index in the target's tab strip, or -1 for a drop on the content area */
    readonly index: number;
    /** the pointer is over a target that a drop rule refused (`onAllowDrop`, `enableDrop`, …) */
    readonly refused: boolean;
    /** the id of the tabset (or border) that refused the drop, when it was one */
    readonly refusedTabSetId: string | undefined;
    /**
     * an auto-hide border with no tabs that the drag reveals, because the pointer is near its edge
     * of the layout (so it can take the drop); main layout only
     */
    readonly revealedBorder: Exclude<DropLocation, "center"> | undefined;
}

/** Options of a drop zone: a consumer element that takes a layout drag. */
export interface IDropZoneOptions {
    /** whether the zone takes this drag (default: every drag of the zone's model) */
    accepts?: ((dragNode: Node & IDraggable) => boolean) | undefined;
    /**
     * called when the drag is dropped on the zone, with the dragged node. The layout does not move
     * anything: dispatch the action you want (e.g. `Actions.deleteTab`). For a new-tab drag (an add
     * or external drag) the node is a temporary tab that is not in the model.
     */
    onDrop: (dragNode: Node & IDraggable, event: DragEventLike) => void;
    /** called when the pointer enters (`true`) or leaves (`false`) the zone during a drag it takes */
    onOverChange?: ((over: boolean) => void) | undefined;
}

interface DropZone {
    element: Element;
    model: Model;
    options: IDropZoneOptions;
    enterCount: number;
    over: boolean;
}

/**
 * How a drag started: a node of the layout (`"internal"`), a floating panel's whole layout
 * (`"float"`), a consumer element that adds a new tab (`"add"`), or a foreign drag accepted by
 * `onExternalDrag` (`"external"`, e.g. files from the OS).
 */
export type DragSource = "internal" | "float" | "add" | "external";

/**
 * Called after an add or external drag was dropped: `node` is the tab the drop created, or
 * `undefined` when `onAction` vetoed (or replaced) the `addTab` action.
 */
export type NewTabDropped = (
    node: TabNode | undefined,
    event: DragEventLike,
) => void;

/** What `onExternalDrag` returns to accept a foreign drag: the tab to create, and a callback. */
export interface IExternalDrag {
    /** the tab the drop creates */
    json: IJsonTabNode;
    /** called after the drop with the created tab (or `undefined` when vetoed) */
    onDrop?: NewTabDropped | undefined;
}

/**
 * Decides whether a drag that did not start in a layout (files, links, text, an element of
 * another library) can be dropped into it. Return the tab to create, or `undefined` to ignore the
 * drag. It is called when the drag enters a layout (once per entry, not for every child element
 * crossed), when the data transfer exposes only its `types` (browsers hide the data itself until
 * the drop): read the payload in `onDrop`.
 */
export type OnExternalDrag = (
    event: DragEventLike,
) => IExternalDrag | undefined;

/** The drag in progress. There is one for the page, shared by every window of a model. */
export class DragState {
    readonly mainEngine: LayoutEngine;
    readonly dragSource: DragSource;
    readonly dragNode: (Node & IDraggable) | undefined;
    /** true when dragging a floating panel's whole layout to dock into another layout */
    readonly dockFloatToMain: boolean;
    readonly floatLayoutId: string | undefined;
    /** the floating panel window the drag came from; drops over it are rejected */
    readonly sourceFloatElement: Element | undefined;
    /** the tab an add or external drag creates on drop */
    readonly dragJson: IJsonTabNode | undefined;
    /** called after an add or external drag was dropped */
    readonly onNewTabDropped: NewTabDropped | undefined;

    constructor(
        mainEngine: LayoutEngine,
        dragSource: DragSource,
        dragNode: (Node & IDraggable) | undefined,
        dockFloatToMain = false,
        floatLayoutId: string | undefined = undefined,
        sourceFloatElement: Element | undefined = undefined,
        dragJson: IJsonTabNode | undefined = undefined,
        onNewTabDropped: NewTabDropped | undefined = undefined,
    ) {
        this.mainEngine = mainEngine;
        this.dragSource = dragSource;
        this.dragNode = dragNode;
        this.dockFloatToMain = dockFloatToMain;
        this.floatLayoutId = floatLayoutId;
        this.sourceFloatElement = sourceFloatElement;
        this.dragJson = dragJson;
        this.onNewTabDropped = onNewTabDropped;
    }

    /** true for drags that create a new tab on drop (add and external) */
    isNewTab(): boolean {
        return this.dragJson !== undefined;
    }
}

/** The subset of a native `DragEvent` the manager uses. */
export type DragEventLike = Pick<
    DragEvent,
    "clientX" | "clientY" | "dataTransfer" | "target" | "preventDefault"
>;

const HIDDEN_RECT = Rect.empty();

/**
 * The drag-and-drop state machine of one layout engine, working on native drag events. The static
 * {@link DragState} is shared across every engine and window of the page, so a drag can cross
 * layouts (popouts and floats participate in the same drag).
 */
export class DragDropManager {
    private static dragState: DragState | undefined = undefined;
    private static readonly dragListeners = new Set<() => void>();
    private static readonly dropZones = new Set<DropZone>();

    private readonly engine: LayoutEngine;
    private dragEnterCount = 0;
    private dragging = false;
    private active = false;
    private dropInfo: DropInfo | undefined;
    private indicator: IDropIndicatorState;
    private readonly listeners = new Set<() => void>();
    private removeLostDragGuard: (() => void) | undefined;

    constructor(engine: LayoutEngine) {
        this.engine = engine;
        this.indicator = this.idleIndicator();
    }

    // *********************************************************************************
    // The page-wide drag state
    // *********************************************************************************

    /** The drag in progress, if any. */
    static getDragState(): DragState | undefined {
        return DragDropManager.dragState;
    }

    /** Calls `listener` when a drag starts or ends. Returns the unsubscribe function. */
    static subscribeDrag(listener: () => void): () => void {
        DragDropManager.dragListeners.add(listener);
        return () => {
            DragDropManager.dragListeners.delete(listener);
        };
    }

    private static setDragState(state: DragState | undefined) {
        if (DragDropManager.dragState === state) {
            return;
        }
        DragDropManager.dragState = state;
        if (state === undefined) {
            for (const zone of DragDropManager.dropZones) {
                DragDropManager.setZoneOver(zone, false);
                zone.enterCount = 0;
            }
        }
        for (const listener of [...DragDropManager.dragListeners]) {
            listener();
        }
    }

    // *********************************************************************************
    // Indicator state
    // *********************************************************************************

    /** The drop indicator of this layout. The same object is returned until it changes. */
    getIndicatorState = (): IDropIndicatorState => this.indicator;

    /** Calls `listener` when the indicator changes. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private idleIndicator(): IDropIndicatorState {
        return {
            visible: false,
            rect: HIDDEN_RECT,
            location: "center",
            kind: "rect",
            dragging: false,
            dragNodeId: undefined,
            showEdges: false,
            tabDragSpeed: this.engine.getTabDragSpeed(),
            targetNodeId: undefined,
            targetTabSetId: undefined,
            index: -1,
            refused: false,
            refusedTabSetId: undefined,
            revealedBorder: undefined,
        };
    }

    private setIndicator(next: IDropIndicatorState) {
        const prev = this.indicator;
        if (
            prev.visible === next.visible &&
            prev.rect.equals(next.rect) &&
            prev.location === next.location &&
            prev.kind === next.kind &&
            prev.dragging === next.dragging &&
            prev.dragNodeId === next.dragNodeId &&
            prev.showEdges === next.showEdges &&
            prev.tabDragSpeed === next.tabDragSpeed &&
            prev.targetNodeId === next.targetNodeId &&
            prev.targetTabSetId === next.targetTabSetId &&
            prev.index === next.index &&
            prev.refused === next.refused &&
            prev.refusedTabSetId === next.refusedTabSetId &&
            prev.revealedBorder === next.revealedBorder
        ) {
            return;
        }
        this.indicator = next;
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    // *********************************************************************************
    // Starting and ending a drag
    // *********************************************************************************

    // a floating panel can be docked into any layout except the floating panel it was dragged from
    private isDockTarget() {
        return (
            this.engine.getLayoutId() !==
            DragDropManager.dragState?.floatLayoutId
        );
    }

    /**
     * center drops are not offered when the dragged node can never merge into a tabset: a floating
     * panel being docked, a tabset that cannot be closed, or a tabset holding pinned tabs
     */
    isExcludeCenter() {
        if (DragDropManager.dragState?.dockFloatToMain) {
            return true;
        }
        const dragNode = DragDropManager.dragState?.dragNode;
        if (dragNode instanceof TabSetNode) {
            return (
                !dragNode.isEnableClose() || dragNode.getPinnedRunLength() > 0
            );
        }
        return false;
    }

    /**
     * Starts dragging `node` (a tab, tabset or group). Call from the source's `dragstart`.
     * `dragImage` is the element the browser snapshots as the drag image; with none, the browser
     * default is used. No text is generated.
     */
    setDragNode = (
        event: DragEventLike,
        node: Node & IDraggable,
        dragImage?: Element | null,
    ) => {
        DragDropManager.setDragState(
            new DragState(this.engine.getMainEngine(), "internal", node),
        );
        this.initDataTransfer(event);
        this.dragEnterCount = 0;
        this.engine.getModel().sortLayouts(); // must have order windows, tabs, floats
        this.installLostDragGuard();

        if (!dragImage) {
            return;
        }
        let x = 10;
        let y = 10;
        const parent =
            node instanceof TabNode ? node.getTabContainer() : node.getParent();
        const isInVerticalBorder =
            parent instanceof BorderNode &&
            parent.getOrientation() === Orientation.HORZ;
        if (node instanceof TabNode && !isInVerticalBorder) {
            // keep the grab point: the image is offset by the pointer position within the element
            const rect = dragImage.getBoundingClientRect();
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        }
        event.dataTransfer?.setDragImage(dragImage, x, y);
    };

    /** Starts dragging a floating panel's whole layout, which can be docked into any other layout. */
    startDockLayoutDrag(
        event: DragEventLike,
        layout: ModelLayout,
        sourceFloatElement?: Element,
        dragImage?: Element | null,
    ) {
        const rowNode = layout.getRootRow() as unknown as Node & IDraggable;
        DragDropManager.setDragState(
            new DragState(
                this.engine.getMainEngine(),
                "float",
                rowNode,
                true,
                layout.getLayoutId(),
                sourceFloatElement,
            ),
        );
        this.initDataTransfer(event);
        this.dragEnterCount = 0;
        this.engine.getModel().sortLayouts(); // must have order windows, tabs, floats
        this.installLostDragGuard();
        if (dragImage) {
            event.dataTransfer?.setDragImage(dragImage, 10, 10);
        }
    }

    /**
     * Starts dragging a new tab from a consumer element (a sidebar item, a palette entry). Call
     * from the element's `dragstart`, and call {@link onDragEnded} from its `dragend`. A drop
     * dispatches `Actions.addTab(json, …)` through the engine, then calls `onDrop` with the new
     * tab. `dragImage` is the element the browser snapshots; with none, the browser default (the
     * source element) is used.
     */
    addTabWithDragAndDrop = (
        event: DragEventLike,
        json: IJsonTabNode,
        onDrop?: NewTabDropped,
        dragImage?: Element | null,
    ) => {
        const tempNode = TabNode.fromJson(json, this.engine.getModel(), false);
        DragDropManager.setDragState(
            new DragState(
                this.engine.getMainEngine(),
                "add",
                tempNode,
                false,
                undefined,
                undefined,
                json,
                onDrop,
            ),
        );
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.setData("text/plain", DRAG_MARKER);
            dataTransfer.effectAllowed = "copy";
            dataTransfer.dropEffect = "copy";
        }
        this.dragEnterCount = 0;
        this.engine.getModel().sortLayouts(); // must have order windows, tabs, floats
        this.installLostDragGuard();
        if (dragImage) {
            event.dataTransfer?.setDragImage(dragImage, 10, 10);
        }
    };

    /** Asks the main engine's `onExternalDrag` whether a foreign drag can be dropped here. */
    private startExternalDrag(event: DragEventLike) {
        const onExternalDrag = this.engine.getMainEngine().getOnExternalDrag();
        const external = onExternalDrag?.(event);
        if (!external) {
            return;
        }
        const tempNode = TabNode.fromJson(
            external.json,
            this.engine.getModel(),
            false,
        );
        DragDropManager.setDragState(
            new DragState(
                this.engine.getMainEngine(),
                "external",
                tempNode,
                false,
                undefined,
                undefined,
                external.json,
                external.onDrop,
            ),
        );
        this.engine.getModel().sortLayouts(); // must have order windows, tabs, floats
        this.installLostDragGuard();
    }

    private initDataTransfer(event: DragEventLike) {
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.setData("text/plain", DRAG_MARKER);
            dataTransfer.effectAllowed = "copyMove";
            dataTransfer.dropEffect = "move";
        }
    }

    /** Ends the drag. Called on `dragend` from the drag source, or by the lost drag fallback. */
    onDragEnded = () => {
        this.clearDragMain();
        this.removeLostDragGuard?.();
        DragDropManager.setDragState(undefined);
    };

    /**
     * Lost drag fallback: `dragend` is dispatched on the drag source, so it never arrives when the
     * source unmounts mid-drag (e.g. its tab moved to another window). A `dragend` seen anywhere in
     * the document, a pointer move with no button held, or a new press ends a drag that is still
     * registered. (A native drag keeps the button down; a move right after `dragstart` can still
     * report a pointer event, so a plain pointer move is not a signal.)
     */
    private installLostDragGuard() {
        this.removeLostDragGuard?.();
        const doc = this.engine.getCurrentDocument();
        if (!doc) {
            return;
        }
        const state = DragDropManager.dragState;
        const end = () => {
            remove();
            if (DragDropManager.dragState === state) {
                this.onDragEnded();
            }
        };
        const onPointerMove = (event: PointerEvent) => {
            if (event.buttons === 0) {
                end();
            }
        };
        const remove = () => {
            doc.removeEventListener("dragend", end, true);
            doc.removeEventListener("pointerdown", end, true);
            doc.removeEventListener("pointermove", onPointerMove, true);
            if (this.removeLostDragGuard === remove) {
                this.removeLostDragGuard = undefined;
            }
        };
        doc.addEventListener("dragend", end, true);
        doc.addEventListener("pointerdown", end, true);
        doc.addEventListener("pointermove", onPointerMove, true);
        this.removeLostDragGuard = remove;
    }

    // *********************************************************************************
    // Native drag events on the layout root
    // *********************************************************************************

    /** decides which layout (the topmost one under the pointer) is the active drop target */
    updateActive(event: DragEventLike) {
        const layouts = Array.from(
            this.engine.getModel().getLayouts().values(),
        );
        const dockToMain = DragDropManager.dragState?.dockFloatToMain === true;
        let found: ModelLayout | undefined;
        let foundTab: ModelLayout | undefined;
        for (let i = layouts.length - 1; i >= 0; i--) {
            const layout = layouts[i];
            if (!layout) {
                continue;
            }
            // the floating panel being dragged is never a drop target
            if (
                dockToMain &&
                layout.getLayoutId() ===
                    DragDropManager.dragState?.floatLayoutId
            ) {
                continue;
            }
            const manager = managerOf(layout);
            if (manager && manager.getDragEnterCount() > 0) {
                if (layout.getType() === "tab") {
                    foundTab = layout;
                } else if (!found && !foundTab) {
                    found = layout;
                }
            }
        }

        if (foundTab) {
            const parentLayout = foundTab.findParentLayout();
            if (found === parentLayout || !found) {
                found = foundTab;
            }
        }

        if (found) {
            managerOf(found)?.setActive(true, event);
        }
        for (const layout of layouts) {
            if (layout !== found) {
                managerOf(layout)?.setActive(false, event);
            }
        }
    }

    setActive(active: boolean, event: DragEventLike) {
        if (this.active !== active) {
            this.active = active;
            if (this.active) {
                this.onDragEnter(event);
            } else {
                this.onDragLeave(event);
            }
        }
    }

    /** `dragenter` on the layout root */
    onDragEnterRaw = (event: DragEventLike) => {
        // ask onExternalDrag once per entry into this layout: dragenter also bubbles from every
        // child the pointer crosses, which the enter count already tracks
        if (!DragDropManager.dragState && this.dragEnterCount === 0) {
            this.startExternalDrag(event);
        }
        this.dragEnterCount++;
        this.updateActive(event);
    };

    /** `dragleave` on the layout root */
    onDragLeaveRaw = (event: DragEventLike) => {
        this.dragEnterCount--;
        this.updateActive(event);
    };

    clearDragMain() {
        this.setPointerOnAllWindows(true);
        for (const [, layout] of this.engine.getModel().getLayouts()) {
            managerOf(layout)?.clearDragLocal();
        }
        // the lost-drag guard stays until the drag really ends (the pointer may come back)
    }

    clearDragLocal() {
        this.dragEnterCount = 0;
        this.active = false;
        this.clearDragLocalVisuals();
    }

    clearDragLocalVisuals() {
        this.dragging = false;
        this.dropInfo = undefined;
        this.setIndicator(this.idleIndicator());
    }

    // FlexLayout shows a transparent overlay over every window during a drag; only its pointer
    // guard is kept: iframes must not swallow the drag events
    private setPointerOnAllWindows(enable: boolean) {
        const docs = new Set<Document>();
        for (const [, layout] of this.engine.getModel().getLayouts()) {
            const doc = layout.getWindow()?.document;
            if (doc) {
                docs.add(doc);
            }
        }
        for (const doc of docs) {
            enablePointerOnIFrames(enable, doc);
        }
    }

    private belongsToDrag(): boolean {
        const state = DragDropManager.dragState;
        if (!state) {
            return false;
        }
        const main = this.engine.getMainEngine();
        if (main === state.mainEngine) {
            return true;
        }
        // a tab of another model in the same drag group
        return this.isGroupTransfer(state);
    }

    /** a drag of a tab of another model whose layout is in this layout's drag group */
    private isGroupTransfer(state: DragState): boolean {
        const group = this.engine.getDragGroup();
        return (
            group !== undefined &&
            state.dragSource === "internal" &&
            state.dragNode instanceof TabNode &&
            state.mainEngine.getModel() !== this.engine.getModel() &&
            group.has(state.mainEngine)
        );
    }

    onDragEnter = (event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        if (
            DragDropManager.dragState?.dockFloatToMain &&
            !this.isDockTarget()
        ) {
            return;
        }
        const dragState = DragDropManager.dragState;
        if (!dragState) {
            return;
        }
        event.preventDefault();

        this.dropInfo = undefined;
        this.dragging = true;
        this.setPointerOnAllWindows(false);

        const model = this.engine.getModel();
        const showEdges =
            model.getMaximizedTabset(this.engine.getLayoutId()) === undefined &&
            model.isEnableEdgeDock();
        const root = this.engine.getFreshDomRect();
        // the outline starts as a 1x1 rect at the pointer (a view may animate from it)
        this.setIndicator({
            visible: false,
            rect: new Rect(
                event.clientX - root.x,
                event.clientY - root.y,
                1,
                1,
            ),
            location: "center",
            kind: "rect",
            dragging: true,
            dragNodeId: dragState.dragNode?.getId(),
            showEdges,
            tabDragSpeed: this.engine.getTabDragSpeed(),
            targetNodeId: undefined,
            targetTabSetId: undefined,
            index: -1,
            refused: false,
            refusedTabSetId: undefined,
            revealedBorder: undefined,
        });
    };

    onDragOver = (event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        const dragState = DragDropManager.dragState;
        if (
            !dragState?.dragNode ||
            (dragState.dockFloatToMain && !this.isDockTarget())
        ) {
            return;
        }
        if (!this.active) {
            return;
        }
        // the pointer over the panel being dragged is never a valid drop target
        if (dragState.dockFloatToMain) {
            const target = event.target as Element | null;
            if (target && dragState.sourceFloatElement?.contains(target)) {
                this.dropInfo = undefined;
                return;
            }
        }

        const root = this.engine.getFreshDomRect();
        const x = event.clientX - root.x;
        const y = event.clientY - root.y;

        const model = this.engine.getModel();
        const revealedBorder = dragState.dockFloatToMain
            ? undefined
            : this.borderToReveal(x, y);
        if (revealedBorder !== this.indicator.revealedBorder) {
            this.setIndicator({ ...this.indicator, revealedBorder });
        }
        model.beginDropProbe();
        let dropInfo = model.findDropTargetNode(
            this.engine.getLayoutId(),
            dragState.dragNode,
            x,
            y,
            this.isExcludeCenter(),
        );
        // a floating panel's layout can split a tabset or dock to a layout edge (the root row),
        // never dock to the center or into a border
        if (
            dropInfo &&
            dragState.dockFloatToMain &&
            (dropInfo.location === DockLocation.CENTER ||
                (!(dropInfo.node instanceof TabSetNode) &&
                    !(dropInfo.node instanceof RowNode)))
        ) {
            dropInfo = undefined;
        }
        if (!dropInfo) {
            // no target here: hide the outline (rather than leave the last one on screen), and
            // report a target that a drop rule refused
            const refusedNode = model.getRefusedDrop();
            if (refusedNode && event.dataTransfer) {
                event.dataTransfer.dropEffect = "none";
            }
            this.dropInfo = undefined;
            this.setIndicator({
                ...this.indicator,
                visible: false,
                targetNodeId: undefined,
                targetTabSetId: undefined,
                index: -1,
                refused: refusedNode !== undefined,
                refusedTabSetId: tabSetOf(refusedNode)?.getId(),
            });
            return;
        }
        event.preventDefault(); // can drop so prevent default (which is cannot drop)
        if (dragState.isNewTab() && event.dataTransfer) {
            // a new tab is a copy of what was dragged (and a file drag allows no "move")
            event.dataTransfer.dropEffect = "copy";
        }
        this.dropInfo = dropInfo;
        this.setIndicator({
            ...this.indicator,
            visible: true,
            rect: dropInfo.rect.clone(),
            location: dropInfo.location.getName() as DropLocation,
            kind: dropInfo.kind,
            targetNodeId: dropInfo.node.getId(),
            targetTabSetId: tabSetOf(dropInfo.node)?.getId(),
            index: dropInfo.index,
            refused: false,
            refusedTabSetId: undefined,
        });
    };

    /**
     * Ported from FlexLayout's LayoutController.checkForBorderToShow: the auto-hide border (with no
     * tabs) whose edge of the main area the pointer is within `edgeDockMargin` of, except over the
     * edge docking bands; `undefined` for none. Unlike FlexLayout, it resets when the drag ends.
     */
    private borderToReveal(
        x: number,
        y: number,
    ): IDropIndicatorState["revealedBorder"] {
        if (!this.engine.isMainLayout()) {
            return undefined;
        }
        const model = this.engine.getModel();
        const row = model.getRootRow(this.engine.getLayoutId());
        const r = row?.getRect();
        if (!r || r.width === 0 || r.height === 0) {
            return undefined;
        }
        const margin = model.getEdgeDockMargin();
        const half = model.getEdgeDockLength() / 2;
        const c = r.getCenter();
        const overEdge =
            model.isEnableEdgeDock() &&
            this.indicator.revealedBorder === undefined &&
            (Math.abs(y - c.y) < half || Math.abs(x - c.x) < half);
        if (overEdge) {
            return undefined;
        }
        const location =
            x <= r.x + margin
                ? DockLocation.LEFT
                : x >= r.getRight() - margin
                  ? DockLocation.RIGHT
                  : y <= r.y + margin
                    ? DockLocation.TOP
                    : y >= r.getBottom() - margin
                      ? DockLocation.BOTTOM
                      : undefined;
        const border = location
            ? model.getBorderSet().getBorderMap().get(location)
            : undefined;
        if (
            !location ||
            !border?.isShowing() ||
            !border.isAutoHide() ||
            border.getChildren().length > 0
        ) {
            return undefined;
        }
        return location.getName() as IDropIndicatorState["revealedBorder"];
    }

    onDragLeave = (_event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        this.clearDragLocalVisuals();

        // an external drag's source is outside the page, so no dragend ends it: it ends when it
        // has left every layout, whichever layout (main, popout, float) it left last
        const external = DragDropManager.dragState?.dragSource === "external";
        if (this.engine.isMainLayout() || external) {
            let anyDragging = false;
            for (const [, layout] of this.engine.getModel().getLayouts()) {
                if (managerOf(layout)?.isDragging()) {
                    anyDragging = true;
                    break;
                }
            }
            if (!anyDragging) {
                this.clearDragMain();
                // unless it moved on to a drop zone, which takes it from here
                if (external && !DragDropManager.isOverAnyZone()) {
                    this.onDragEnded();
                }
            }
        }
    };

    /**
     * `drop` on the layout root: dispatches `Actions.moveNode` (or `dockFloatToLayout`, or `addTab`
     * for add and external drags) through the engine
     */
    onDrop = (event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        const dragState = DragDropManager.dragState;
        if (dragState?.dockFloatToMain && !this.isDockTarget()) {
            return;
        }
        if (this.active && dragState) {
            event.preventDefault();

            let dropInfo = this.dropInfo;
            // a floating panel can never be dropped back into the panel it was dragged from
            if (dropInfo && dragState.dockFloatToMain) {
                const target = event.target as Element | null;
                if (target && dragState.sourceFloatElement?.contains(target)) {
                    dropInfo = undefined;
                }
            }
            if (dropInfo && this.isGroupTransfer(dragState)) {
                this.engine
                    .getDragGroup()
                    ?.transferTab(
                        dragState.mainEngine,
                        this.engine,
                        dragState.dragNode as TabNode,
                        dropInfo.node.getId(),
                        dropInfo.location,
                        dropInfo.index,
                    );
            } else if (dropInfo && dragState.dragJson !== undefined) {
                const added = this.engine.doAction(
                    Actions.addTab(
                        dragState.dragJson,
                        dropInfo.node.getId(),
                        dropInfo.location,
                        dropInfo.index,
                    ),
                );
                dragState.onNewTabDropped?.(
                    added instanceof TabNode ? added : undefined,
                    event,
                );
            } else if (dropInfo && dragState.dragNode !== undefined) {
                if (
                    dragState.dockFloatToMain &&
                    dragState.floatLayoutId !== undefined
                ) {
                    this.engine.doAction(
                        Actions.dockFloatToLayout(
                            dragState.floatLayoutId,
                            dropInfo.node.getId(),
                            dropInfo.location,
                            dropInfo.index,
                        ),
                    );
                } else {
                    this.engine.doAction(
                        Actions.moveNode(
                            dragState.dragNode.getId(),
                            dropInfo.node.getId(),
                            dropInfo.location,
                            dropInfo.index,
                        ),
                    );
                }
            }

            this.clearDragMain();
            this.removeLostDragGuard?.();
            if (dragState.mainEngine !== this.engine.getMainEngine()) {
                // a drag from another layout of the group: clear the source's layouts too
                dragState.mainEngine.getDragDropManager().clearDragMain();
            }
            DragDropManager.setDragState(undefined);
        }
        this.dragEnterCount = 0;
    };

    /** Hides this layout's outline without ending the drag (the pointer is over a drop zone). */
    hideIndicator() {
        this.dropInfo = undefined;
        if (this.indicator.visible || this.indicator.refused) {
            this.setIndicator({
                ...this.indicator,
                visible: false,
                targetNodeId: undefined,
                targetTabSetId: undefined,
                index: -1,
                refused: false,
                refusedTabSetId: undefined,
            });
        }
    }

    // *********************************************************************************
    // Drop zones
    // *********************************************************************************

    /**
     * Makes `element` (anywhere in the document, inside or outside a layout root) a drop zone for
     * drags of `model`'s layouts. While a drag the zone accepts is over it, the layouts show no
     * outline, and a drop calls `onDrop` with the dragged node instead of moving anything.
     * Returns the function that unregisters the zone.
     */
    static registerDropZone(
        model: Model,
        element: Element,
        options: IDropZoneOptions,
    ): () => void {
        const zone: DropZone = {
            element,
            model,
            options,
            enterCount: 0,
            over: false,
        };
        DragDropManager.dropZones.add(zone);
        const accepts = () => {
            const state = DragDropManager.dragState;
            return (
                state?.dragNode !== undefined &&
                state.mainEngine.getModel() === model &&
                (zone.options.accepts?.(state.dragNode) ?? true)
            );
        };
        const onEnter = (event: Event) => {
            if (!accepts()) return;
            // the zone takes the drag: the layouts under or around it must not
            event.stopPropagation();
            event.preventDefault();
            zone.enterCount++;
            DragDropManager.setZoneOver(zone, true);
            DragDropManager.hideIndicators(model);
        };
        const onOver = (event: Event) => {
            if (!accepts()) return;
            event.stopPropagation();
            event.preventDefault();
            const dataTransfer = (event as DragEvent).dataTransfer;
            if (dataTransfer) {
                dataTransfer.dropEffect = DragDropManager.dragState?.isNewTab()
                    ? "copy"
                    : "move";
            }
            DragDropManager.setZoneOver(zone, true);
            DragDropManager.hideIndicators(model);
        };
        const onLeave = (event: Event) => {
            if (!zone.over) return;
            event.stopPropagation();
            zone.enterCount = Math.max(0, zone.enterCount - 1);
            if (zone.enterCount === 0) {
                DragDropManager.setZoneOver(zone, false);
                DragDropManager.endExternalDragOutside(model);
            }
        };
        const onDrop = (event: Event) => {
            const state = DragDropManager.dragState;
            if (!accepts() || !state?.dragNode) return;
            event.stopPropagation();
            event.preventDefault();
            DragDropManager.setZoneOver(zone, false);
            zone.options.onDrop(state.dragNode, event as DragEvent);
            // the drag is over: the source's dragend (if any) finds nothing left to end
            state.mainEngine.getDragDropManager().clearDragMain();
            DragDropManager.setDragState(undefined);
        };
        element.addEventListener("dragenter", onEnter);
        element.addEventListener("dragover", onOver);
        element.addEventListener("dragleave", onLeave);
        element.addEventListener("drop", onDrop);
        return () => {
            element.removeEventListener("dragenter", onEnter);
            element.removeEventListener("dragover", onOver);
            element.removeEventListener("dragleave", onLeave);
            element.removeEventListener("drop", onDrop);
            DragDropManager.dropZones.delete(zone);
        };
    }

    private static isOverAnyZone(): boolean {
        for (const zone of DragDropManager.dropZones) {
            if (zone.over) return true;
        }
        return false;
    }

    /**
     * An external drag has no dragend in this page: when it leaves a drop zone for a place that is
     * neither a layout nor another zone, it is over.
     */
    private static endExternalDragOutside(model: Model) {
        const state = DragDropManager.dragState;
        if (
            state?.dragSource !== "external" ||
            state.mainEngine.getModel() !== model ||
            DragDropManager.isOverAnyZone()
        ) {
            return;
        }
        for (const [, layout] of model.getLayouts()) {
            if (managerOf(layout)?.isDragging()) return;
        }
        state.mainEngine.getDragDropManager().onDragEnded();
    }

    private static setZoneOver(zone: DropZone, over: boolean) {
        if (zone.over !== over) {
            zone.over = over;
            zone.options.onOverChange?.(over);
        }
    }

    private static hideIndicators(model: Model) {
        for (const [, layout] of model.getLayouts()) {
            managerOf(layout)?.hideIndicator();
        }
    }

    getDragEnterCount() {
        return this.dragEnterCount;
    }

    isDragging() {
        return this.dragging;
    }

    /** Detaches the lost drag guard. */
    dispose() {
        this.removeLostDragGuard?.();
        this.listeners.clear();
    }
}

/** The tabset a drop target belongs to: itself, or the tabset holding a tab group. */
/** the tab container (a tabset or a border) a drop target belongs to */
function tabSetOf(node: Node | undefined): TabSetNode | BorderNode | undefined {
    if (node instanceof TabSetNode || node instanceof BorderNode) {
        return node;
    }
    if (node instanceof TabGroupNode) {
        const parent = node.getParent();
        return parent instanceof TabSetNode || parent instanceof BorderNode
            ? parent
            : undefined;
    }
    return undefined;
}

function managerOf(layout: ModelLayout): DragDropManager | undefined {
    const controller = layout.getController() as
        | { getDragDropManager?: () => DragDropManager }
        | undefined;
    return controller?.getDragDropManager?.();
}
