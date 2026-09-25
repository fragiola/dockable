import type { IJsonTabNode, Model, NewTabDropped } from "@fragiola/dockable";
import type * as React from "react";
import { useDragSource } from "./hooks";
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
export interface DragSourceProps
    extends Omit<DivPrimitiveProps<DragSourceState>, "onDrop"> {
    /** the model of the layout the new tab is dropped into (its `Dockable.Root` must be mounted) */
    model: Model;
    /** the tab a drop creates; a function is called at each drag start */
    json: IJsonTabNode | (() => IJsonTabNode);
    /** called after the drop with the created tab, or `undefined` when `onAction` vetoed it */
    onDrop?: NewTabDropped | undefined;
    /** no drag starts while true */
    disabled?: boolean | undefined;
    /** the source's content; the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * An element, anywhere on the page, that can be dragged into a layout to create a new tab: a
 * sidebar of widgets, a file list, a palette. The drop dispatches `Actions.addTab` through the
 * layout's engine (interceptable by `onAction`, filtered by `onAllowDrop`). It is itself the drag
 * image. It renders a `div` with `draggable`; give it a role and a name that fit your UI, and
 * offer a keyboard path to the same action (a click, a menu): native drag and drop has none.
 */
export function DragSource(props: DragSourceProps) {
    const { model, json, onDrop, disabled, children, ...rest } = props;
    const drag = useDragSource({ model, json, onDrop, disabled });
    const state: DragSourceState = {
        dragging: drag.dragging,
        disabled: disabled === true,
    };
    return useRenderElement("div", rest, {
        state,
        ref: drag.ref,
        props: {
            ...dataAttributes({
                dragging: state.dragging,
                disabled: state.disabled,
            }),
            "aria-disabled": state.disabled || undefined,
            draggable: drag.draggable,
            onDragStart: drag.onDragStart,
            onDragEnd: drag.onDragEnd,
            children,
        },
    });
}
