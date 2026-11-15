import type { AnyTypes, DockableTypes } from "@fragiola/dockable";
import { type UseDragSourceOptions, useDragSource } from "./composables";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import { dataAttributes, type RenderSlot, renderElement } from "./utils/render";

export interface DragSourceState {
    /** a drag started by this source is in progress */
    dragging: boolean;
    /** the source is disabled */
    disabled: boolean;
}

// `onDrop` is the new-tab callback here, not the element's native drop listener (a drag source
// is never a drop target)
export interface DragSourceProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps,
        UseDragSourceOptions<T> {}

export interface DragSourceSlots extends RenderSlot<DragSourceState> {
    /** the source's content; the primitive renders no text of its own */
    default?: SlotFunction<{ state: DragSourceState }>;
}

/**
 * An element, anywhere on the page, that can be dragged into a layout to create a new tab: a
 * sidebar of widgets, a file list, a palette. The drop runs `tab.add` through the model's
 * middleware, which can veto or rewrite it. It is itself the drag image. It renders a `div` with
 * `draggable`; give it a role and a name that fit your UI, and offer a keyboard path to the same
 * command (a click, a menu): native drag and drop has none.
 */
export const DragSource: DockableComponent<DragSourceProps, DragSourceSlots> =
    definePrimitive<DragSourceProps, DragSourceSlots>(
        "DragSource",
        ["model", "tab", "onDrop", "disabled", "as"],
        (props, { attrs, slots }) => {
            const drag = useDragSource(() => ({
                model: props.model,
                tab: props.tab,
                onDrop: props.onDrop,
                disabled: props.disabled,
            }));
            return () => {
                const { ref, ...dragProps } = drag.props.value;
                const state: DragSourceState = {
                    dragging: drag.state.value.dragging,
                    disabled: props.disabled === true,
                };
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    ref,
                    props: {
                        ...dataAttributes({
                            dragging: state.dragging,
                            disabled: state.disabled,
                        }),
                        "aria-disabled": state.disabled || undefined,
                        ...dragProps,
                    },
                    children: () => slots.default?.({ state }),
                });
            };
        },
    );
