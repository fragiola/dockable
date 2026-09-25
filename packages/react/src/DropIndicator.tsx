import {
    DROP_INDICATOR_PATH,
    type DropKind,
    type DropLocation,
} from "@fragiola/dockable";
import * as React from "react";
import { useLayoutContext } from "./context";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

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
}

export interface DropIndicatorProps
    extends DivPrimitiveProps<DropIndicatorState> {
    children?: React.ReactNode;
}

/**
 * The drop outline of a drag: one element, positioned (structurally) over the rect the core
 * computed, hidden when there is no drop target. Place it anywhere inside `Dockable.Root`. It
 * has no content of its own.
 */
export function DropIndicator(props: DropIndicatorProps) {
    const { children, ...rest } = props;
    const { engine } = useLayoutContext("DropIndicator");
    const manager = engine.getDragDropManager();
    const indicator = React.useSyncExternalStore(
        manager.subscribe,
        manager.getIndicatorState,
        manager.getIndicatorState,
    );

    const state: DropIndicatorState = {
        visible: indicator.visible,
        location: indicator.location,
        kind: indicator.kind,
        dragging: indicator.dragging,
        showEdges: indicator.showEdges,
        tabDragSpeed: indicator.tabDragSpeed,
        refused: indicator.refused,
    };
    const { rect } = indicator;
    return useRenderElement("div", rest, {
        state,
        props: {
            "aria-hidden": true,
            ...dataAttributes({
                "layout-path": DROP_INDICATOR_PATH,
                "drop-location": indicator.visible
                    ? indicator.location
                    : undefined,
                "drop-kind": indicator.visible ? indicator.kind : undefined,
                visible: indicator.visible,
                dragging: indicator.dragging,
                "drop-refused": indicator.refused,
            }),
            children,
        },
        style: {
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: Math.max(0, rect.width),
            height: Math.max(0, rect.height),
            display: indicator.visible ? undefined : "none",
            // hit-testing, not cosmetics: an indicator under the pointer would take the drag's
            // enter/leave events from the layout and make the browser cancel the drop
            pointerEvents: "none",
        },
    });
}
