import type {
    AnyTypes,
    DockableTypes,
    Model,
    NewTabDropped,
    TabInitOf,
} from "@fragiola/dockable";
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
export interface DragSourceProps<T extends DockableTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<DragSourceState>, "onDrop"> {
    /** the model of the layout the new tab is dropped into (its `Dockable.Root` must be mounted) */
    model: Model<T>;
    /**
     * the tab a drop creates (a `tab.add` init: `data` is checked against `component`); a function
     * is called at each drag start
     */
    tab: TabInitOf<T> | (() => TabInitOf<T>);
    /** called after the drop with the new tab's id, or `undefined` when the add was refused */
    onDrop?: NewTabDropped | undefined;
    /** no drag starts while true */
    disabled?: boolean | undefined;
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
