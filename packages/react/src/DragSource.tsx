import type { AnyTypes, DockableTypes } from "@fragiola/dockable";
import type * as React from "react";
import { type UseDragSourceOptions, useDragSource } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface DragSourceState {
    /** a drag started by this source is in progress */
    dragging: boolean;
    /** the source is disabled */
    disabled: boolean;
}

// `onDrop` is the new-tab callback here, not the element's native drop handler (a drag source
// is never a drop target)
export interface DragSourceProps<T extends DockableTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<DragSourceState>, "onDrop">,
        UseDragSourceOptions<T> {
    /** the source's content; the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * An element, anywhere on the page, that can be dragged into a layout to create a new tab: a
 * sidebar of widgets, a file list, a palette. The drop runs `tab.add` through the model's
 * middleware, which can veto or rewrite it. It is itself the drag image. It renders a `div` with
 * `draggable`; give it a role and a name that fit your UI, and offer a keyboard path to the same
 * command (a click, a menu): native drag and drop has none.
 */
export function DragSource<T extends DockableTypes = AnyTypes>(
    props: DragSourceProps<T>,
) {
    const { model, tab, onDrop, disabled, children, ...rest } = props;
    const drag = useDragSource({ model, tab, onDrop, disabled });
    const { ref, ...dragProps } = drag.props;
    const state: DragSourceState = {
        dragging: drag.state.dragging,
        disabled: disabled === true,
    };
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            ...dataAttributes({
                dragging: state.dragging,
                disabled: state.disabled,
            }),
            "aria-disabled": state.disabled || undefined,
            ...dragProps,
            children,
        },
    });
}
