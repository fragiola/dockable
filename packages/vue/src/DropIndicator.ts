import {
    DROP_INDICATOR_PATH,
    type DropKind,
    type DropLocation,
} from "@fragiola/dockable";
import { useIndicator } from "./composables";
import { useLayoutContext } from "./context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import {
    dataAttributes,
    px,
    type RenderSlot,
    renderElement,
} from "./utils/render";

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

export type DropIndicatorProps = PrimitiveProps;

export interface DropIndicatorSlots extends RenderSlot<DropIndicatorState> {
    /** its content; the primitive renders none */
    default?: SlotFunction<{ state: DropIndicatorState }>;
}

/**
 * The drop outline of a drag: one element, positioned (structurally) over the rect the core
 * computed, hidden when there is no drop target. Place it anywhere inside `Dockable.Root`. It
 * has no content of its own.
 */
export const DropIndicator: DockableComponent<
    DropIndicatorProps,
    DropIndicatorSlots
> = definePrimitive<DropIndicatorProps, DropIndicatorSlots>(
    "DropIndicator",
    ["as"],
    (props, { attrs, slots }) => {
        const { engine } = useLayoutContext("DropIndicator");
        const indicator = useIndicator(engine, (current) => current);
        return () => {
            const current = indicator.value;
            const state: DropIndicatorState = {
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
            const { rect } = current;
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: {
                    "aria-hidden": true,
                    ...dataAttributes({
                        "layout-path": DROP_INDICATOR_PATH,
                        "drop-location": current.visible
                            ? current.location
                            : undefined,
                        "drop-kind": current.visible ? current.kind : undefined,
                        visible: current.visible,
                        dragging: current.dragging,
                        "drop-refused": current.refused,
                    }),
                },
                style: {
                    position: "absolute",
                    left: px(rect.x),
                    top: px(rect.y),
                    width: px(Math.max(0, rect.width)),
                    height: px(Math.max(0, rect.height)),
                    display: current.visible ? undefined : "none",
                    // hit-testing, not cosmetics: an indicator under the pointer would take the
                    // drag's enter/leave events from the layout and make the browser cancel the drop
                    pointerEvents: "none",
                },
                children: slots.default
                    ? () => slots.default?.({ state })
                    : undefined,
            });
        };
    },
);
