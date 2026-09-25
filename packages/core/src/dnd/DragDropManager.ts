// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/DragDropManager.tsx,
// with React, JSX and class names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see
// LICENSE.
//
// Differences from FlexLayout:
// - the drop outline is not a classed div the manager creates and positions: the manager exposes
//   a subscribable indicator state that a view renders (`Dockable.DropIndicator`);
// - the drag image is an element the adapter provides (no React root rendered at dragstart, no
//   generated text);
// - external drags and "add" drags (DragSource.External / DragSource.Add, addTabWithDragAndDrop,
//   onExternalDrag, fnNewNodeDropped, dragJson) are not ported (product decision), nor the overlay
//   border reveal during a drag (borders slice).
import type { LayoutEngine } from "../engine/LayoutEngine";
import { Actions } from "../model/Actions";
import { BorderNode } from "../model/BorderNode";
import { DockLocation } from "../model/DockLocation";
import type { DropInfo, DropKind } from "../model/DropInfo";
import type { IDraggable } from "../model/IDraggable";
import type { ModelLayout } from "../model/ModelLayout";
import type { Node } from "../model/Node";
import { Orientation } from "../model/Orientation";
import { Rect } from "../model/Rect";
import { RowNode } from "../model/RowNode";
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
}

/** How a drag started: a node of the layout, or a floating panel's whole layout. */
export type DragSource = "internal" | "float";

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

    constructor(
        mainEngine: LayoutEngine,
        dragSource: DragSource,
        dragNode: (Node & IDraggable) | undefined,
        dockFloatToMain = false,
        floatLayoutId: string | undefined = undefined,
        sourceFloatElement: Element | undefined = undefined,
    ) {
        this.mainEngine = mainEngine;
        this.dragSource = dragSource;
        this.dragNode = dragNode;
        this.dockFloatToMain = dockFloatToMain;
        this.floatLayoutId = floatLayoutId;
        this.sourceFloatElement = sourceFloatElement;
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
            prev.tabDragSpeed === next.tabDragSpeed
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
        const parent = node.getParent();
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
        this.removeLostDragGuard?.();
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
        return (
            this.engine.getMainEngine() ===
            DragDropManager.dragState?.mainEngine
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

        const dropInfo = this.engine
            .getModel()
            .findDropTargetNode(
                this.engine.getLayoutId(),
                dragState.dragNode,
                x,
                y,
                this.isExcludeCenter(),
            );
        if (!dropInfo) {
            return;
        }
        // a floating panel's layout can split a tabset or dock to a layout edge (the root row),
        // never dock to the center or into a border
        if (
            dragState.dockFloatToMain &&
            (dropInfo.location === DockLocation.CENTER ||
                (!(dropInfo.node instanceof TabSetNode) &&
                    !(dropInfo.node instanceof RowNode)))
        ) {
            return;
        }
        event.preventDefault(); // can drop so prevent default (which is cannot drop)
        this.dropInfo = dropInfo;
        this.setIndicator({
            ...this.indicator,
            visible: true,
            rect: dropInfo.rect.clone(),
            location: dropInfo.location.getName() as DropLocation,
            kind: dropInfo.kind,
        });
    };

    onDragLeave = (_event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        this.clearDragLocalVisuals();

        if (this.engine.isMainLayout()) {
            let anyDragging = false;
            for (const [, layout] of this.engine.getModel().getLayouts()) {
                if (managerOf(layout)?.isDragging()) {
                    anyDragging = true;
                    break;
                }
            }
            if (!anyDragging) {
                this.clearDragMain();
            }
        }
    };

    /** `drop` on the layout root: dispatches `Actions.moveNode` (or `dockFloatToLayout`) through the engine */
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
            if (dropInfo && dragState.dragNode !== undefined) {
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
            DragDropManager.setDragState(undefined);
        }
        this.dragEnterCount = 0;
    };

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

function managerOf(layout: ModelLayout): DragDropManager | undefined {
    const controller = layout.getController() as
        | { getDragDropManager?: () => DragDropManager }
        | undefined;
    return controller?.getDragDropManager?.();
}
