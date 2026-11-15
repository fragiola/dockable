import type { AnyTypes, DockableTypes } from "@fragiola/dockable";
import {
    type DropZoneState,
    type UseDropZoneOptions,
    useDropZone,
} from "./composables";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import { dataAttributes, type RenderSlot, renderElement } from "./utils/render";

export type { DropZoneState };

// `onDrop` is the zone's callback with what is dragged, not the element's native drop listener
export interface DropZoneProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps,
        UseDropZoneOptions<T> {}

export interface DropZoneSlots extends RenderSlot<DropZoneState> {
    /** the zone's content; the primitive renders no text of its own */
    default?: SlotFunction<{ state: DropZoneState }>;
}

/**
 * A place, inside or outside the layout, where a drag of the layout can be dropped for you to
 * handle: a trash can that closes the tab, an "open to the right" pad, a region of the page. While
 * a drag it takes is over it, the layout shows no outline, and a drop calls `onDrop` with what is
 * dragged instead of moving it.
 */
export const DropZone: DockableComponent<DropZoneProps, DropZoneSlots> =
    definePrimitive<DropZoneProps, DropZoneSlots>(
        "DropZone",
        ["model", "accepts", "onDrop", "as"],
        (props, { attrs, slots }) => {
            const { state, props: zone } = useDropZone(() => ({
                model: props.model,
                accepts: props.accepts,
                onDrop: props.onDrop,
            }));
            return () => {
                const current = state.value;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: current,
                    ref: zone.value.ref,
                    props: dataAttributes({
                        "drop-over": current.over,
                        "drop-active": current.active,
                    }),
                    children: () => slots.default?.({ state: current }),
                });
            };
        },
    );
