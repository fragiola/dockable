// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/EdgeIndicators.tsx
// (the edge targets shown during a drag); the markup, icons and class names are not copied.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { BorderLocation } from "@fragiola/dockable";
import { useIndicator } from "../composables/internal";
import { useLayoutContext } from "../context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    dataAttributes,
    px,
    type RenderSlot,
    renderElement,
} from "../utils/render";

export interface EdgeIndicatorState {
    edge: BorderLocation;
    /** a drag that can dock to the layout's edges is over the layout */
    visible: boolean;
    /** the drop would dock to this edge */
    dropTarget: boolean;
}

export interface EdgeIndicatorProps extends PrimitiveProps {
    /** the layout edge it marks */
    edge: BorderLocation;
}

export interface EdgeIndicatorSlots extends RenderSlot<EdgeIndicatorState> {
    /** its content (an arrow icon); the primitive renders none */
    default?: SlotFunction<{ state: EdgeIndicatorState }>;
}

/**
 * Marks the band along one edge of the layout where a drop docks to that edge. It is positioned
 * (structurally) over the band the core computes, shown only while a drag that can dock to the
 * edges is over the layout. `pointer-events: none`, like the drop indicator. Place one per edge
 * inside `Dockable.Root`; its stacking (`z-index`) is yours.
 */
export const EdgeIndicator: DockableComponent<
    EdgeIndicatorProps,
    EdgeIndicatorSlots
> = definePrimitive<EdgeIndicatorProps, EdgeIndicatorSlots>(
    "EdgeIndicator",
    ["edge", "as"],
    (props, { attrs, slots }) => {
        const { engine } = useLayoutContext("EdgeIndicator");
        const indicator = useIndicator(engine, (current) => current);
        return () => {
            const current = indicator.value;
            const edge = props.edge;
            const visible = current.dragging && current.showEdges;
            const rect = visible
                ? engine.adapter
                      .edgeBands()
                      .find((band) => band.location === edge)?.rect
                : undefined;
            const state: EdgeIndicatorState = {
                edge,
                visible: rect !== undefined,
                dropTarget:
                    current.visible &&
                    current.kind === "edge" &&
                    current.location === edge,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: {
                    "aria-hidden": true,
                    ...dataAttributes({
                        "layout-path": `/edge/${edge}`,
                        edge,
                        visible: state.visible,
                        "drop-target": state.dropTarget,
                    }),
                },
                style: {
                    position: "absolute",
                    left: px(rect?.x ?? 0),
                    top: px(rect?.y ?? 0),
                    width: px(rect?.width ?? 0),
                    height: px(rect?.height ?? 0),
                    display: rect ? undefined : "none",
                    // an indicator under the pointer would take the drag's enter/leave events
                    pointerEvents: "none",
                },
                children: slots.default
                    ? () => slots.default?.({ state })
                    : undefined,
            });
        };
    },
);
