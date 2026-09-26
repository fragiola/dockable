// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/EdgeIndicators.tsx
// (the edge targets shown during a drag); the markup, icons and class names are not copied.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import * as React from "react";
import { useLayoutContext } from "./context";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export type Edge = "top" | "bottom" | "left" | "right";

export interface EdgeIndicatorState {
    edge: Edge;
    /** a drag that can dock to the layout's edges is over the layout */
    visible: boolean;
    /** the drop would dock to this edge */
    dropTarget: boolean;
}

export interface EdgeIndicatorProps
    extends DivPrimitiveProps<EdgeIndicatorState> {
    /** the layout edge it marks */
    edge: Edge;
    /** its content (an arrow icon); the primitive renders none */
    children?: React.ReactNode;
}

/**
 * Marks the band along one edge of the layout where a drop docks to that edge. It is positioned
 * (structurally) over the band the core computes (`edgeDockMargin` deep, `edgeDockLength` long,
 * centred), shown only while a drag that can dock to the edges is over the layout and the model's
 * `enableEdgeDockIndicators` is on. `pointer-events: none`, like the drop indicator. Place one per
 * edge inside `Dockable.Root`; its stacking (`z-index`) is yours.
 */
export function EdgeIndicator(props: EdgeIndicatorProps) {
    const { edge, children, ...rest } = props;
    const { engine, layoutId } = useLayoutContext("EdgeIndicator");
    const manager = engine.getDragDropManager();
    const indicator = React.useSyncExternalStore(
        manager.subscribe,
        manager.getIndicatorState,
        manager.getIndicatorState,
    );
    const model = engine.getModel();
    const visible =
        indicator.dragging &&
        indicator.showEdges &&
        model.isEnableEdgeDockIndicators();
    const rect = visible
        ? model
              .getEdgeDockRects(layoutId)
              .find((band) => band.location.getName() === edge)?.rect
        : undefined;
    const state: EdgeIndicatorState = {
        edge,
        visible: rect !== undefined,
        dropTarget:
            indicator.visible &&
            indicator.kind === "edge" &&
            indicator.location === edge,
    };
    return useRenderElement("div", rest, {
        state,
        props: {
            "aria-hidden": true,
            ...dataAttributes({
                "layout-path": `/edge/${edge}`,
                edge,
                visible: state.visible,
                "drop-target": state.dropTarget,
            }),
            children,
        },
        style: {
            position: "absolute",
            left: rect?.x ?? 0,
            top: rect?.y ?? 0,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            display: rect ? undefined : "none",
            // an indicator under the pointer would take the drag's enter/leave events
            pointerEvents: "none",
        },
    });
}
