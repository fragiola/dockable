import { computed, Directive, input, type Signal } from "@angular/core";
import {
    type BorderLocation,
    DROP_INDICATOR_PATH,
    type DropKind,
    type DropLocation,
} from "@fragiola/dockable";
import { injectLayoutContext } from "./context";
import { indicatorSignal } from "./internal";
import { bindStructuralStyle, dataAttr, injectHost, px } from "./utils";

export interface DropIndicatorState {
    /** a drop target is under the pointer */
    visible: boolean;
    /** where the dragged node would dock relative to the target */
    location: DropLocation;
    /** `"edge"` for a drop at the outer edge of a row, `"rect"` otherwise */
    kind: DropKind;
    /** a drag is over the layout */
    dragging: boolean;
    /** edge docking is available for this drag */
    showEdges: boolean;
    /** seconds a style may take to animate between targets */
    tabDragSpeed: number;
    /** the pointer is over a target that a drop rule refused (the outline is hidden) */
    refused: boolean;
    /** the id of the drop target node (a tabset, a row for edge drops, a border) */
    targetNodeId: string | undefined;
    /** the id of the tabset (or border) the drop goes into or beside */
    targetTabsetId: string | undefined;
}

/**
 * The drop outline of a drag: `<div dockableDropIndicator>`, positioned (structurally) over the
 * rect the core computed, hidden when there is no drop target. Put it anywhere inside
 * `[dockableRoot]`; its stacking (`z-index`) is yours. It has no content of its own.
 */
@Directive({
    selector: "[dockableDropIndicator]",
    exportAs: "dockableDropIndicator",
    host: {
        "aria-hidden": "true",
        "[attr.data-layout-path]": "path",
        "[attr.data-drop-location]": "data().location",
        "[attr.data-drop-kind]": "data().kind",
        "[attr.data-visible]": "data().visible",
        "[attr.data-dragging]": "data().dragging",
        "[attr.data-drop-refused]": "data().refused",
    },
})
export class DockableDropIndicator {
    private readonly layout = injectLayoutContext("[dockableDropIndicator]");
    private readonly indicator = indicatorSignal(
        this.layout.engine,
        (current) => current,
    );
    protected readonly path = DROP_INDICATOR_PATH;

    /** what the indicator shows */
    readonly state: Signal<DropIndicatorState> = computed(() => {
        const current = this.indicator();
        return {
            visible: current.visible,
            location: current.location,
            kind: current.kind,
            dragging: current.dragging,
            showEdges: current.showEdges,
            tabDragSpeed: current.tabDragSpeed,
            refused: current.refused,
            targetNodeId: current.targetNodeId,
            targetTabsetId: current.targetTabsetId,
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            location: state.visible ? state.location : null,
            kind: state.visible ? state.kind : null,
            visible: dataAttr(state.visible),
            dragging: dataAttr(state.dragging),
            refused: dataAttr(state.refused),
        };
    });

    constructor() {
        bindStructuralStyle(injectHost(), () => {
            const current = this.indicator();
            const { rect } = current;
            return {
                position: "absolute",
                left: px(rect.x),
                top: px(rect.y),
                width: px(Math.max(0, rect.width)),
                height: px(Math.max(0, rect.height)),
                display: current.visible ? undefined : "none",
                // hit-testing, not cosmetics: an indicator under the pointer would take the drag's
                // enter/leave events from the layout and make the browser cancel the drop
                pointerEvents: "none",
            };
        });
    }
}

export interface EdgeIndicatorState {
    edge: BorderLocation;
    /** a drag that can dock to the layout's edges is over the layout */
    visible: boolean;
    /** the drop would dock to this edge */
    dropTarget: boolean;
}

/**
 * Marks the band along one edge of the layout where a drop docks to that edge:
 * `<div dockableEdgeIndicator="top">`. It is positioned (structurally) over the band the core
 * computes, shown only while a drag that can dock to the edges is over the layout.
 * `pointer-events: none`, like the drop indicator. Put one per edge inside `[dockableRoot]`; its
 * stacking (`z-index`) is yours.
 */
@Directive({
    selector: "[dockableEdgeIndicator]",
    exportAs: "dockableEdgeIndicator",
    host: {
        "aria-hidden": "true",
        "[attr.data-layout-path]": "data().path",
        "[attr.data-edge]": "state().edge",
        "[attr.data-visible]": "data().visible",
        "[attr.data-drop-target]": "data().dropTarget",
    },
})
export class DockableEdgeIndicator {
    /** the layout edge it marks */
    readonly dockableEdgeIndicator = input.required<BorderLocation>();

    private readonly layout = injectLayoutContext("[dockableEdgeIndicator]");
    private readonly indicator = indicatorSignal(
        this.layout.engine,
        (current) => current,
    );
    private readonly rect = computed(() => {
        const current = this.indicator();
        const edge = this.dockableEdgeIndicator();
        return current.dragging && current.showEdges
            ? this.layout
                  .engine()
                  .adapter.edgeBands()
                  .find((band) => band.location === edge)?.rect
            : undefined;
    });

    /** what the indicator shows */
    readonly state: Signal<EdgeIndicatorState> = computed(() => {
        const current = this.indicator();
        const edge = this.dockableEdgeIndicator();
        return {
            edge,
            visible: this.rect() !== undefined,
            dropTarget:
                current.visible &&
                current.kind === "edge" &&
                current.location === edge,
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: `/edge/${state.edge}`,
            visible: dataAttr(state.visible),
            dropTarget: dataAttr(state.dropTarget),
        };
    });

    constructor() {
        bindStructuralStyle(injectHost(), () => {
            const rect = this.rect();
            return {
                position: "absolute",
                left: px(rect?.x ?? 0),
                top: px(rect?.y ?? 0),
                width: px(rect?.width ?? 0),
                height: px(rect?.height ?? 0),
                display: rect ? undefined : "none",
                // an indicator under the pointer would take the drag's enter/leave events
                pointerEvents: "none",
            };
        });
    }
}
