// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type DockableTypes,
    DragDropManager,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import * as React from "react";
import { useDockableContext, useLayoutContext } from "../context";
import { useDragState } from "./internal";

/** What goes on a draggable element. */
export interface DragProps {
    /** whether the element is draggable */
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd: (event: React.DragEvent<HTMLElement>) => void;
    /**
     * callback ref for the element the browser snapshots as the drag image: the dragged element
     * itself, unless you attach it to another one
     */
    ref: React.RefCallback<HTMLElement>;
}

export interface UseDragNodeResult {
    state: {
        /** this node is being dragged */
        dragging: boolean;
    };
    /** what goes on the dragged element (the DOM `draggable` follows the node's `draggable` setting) */
    props: DragProps;
}

/**
 * The lower layer of a draggable part: wires a tab or a tabset to the core's drag-and-drop
 * machine. Spread `props` on the dragged element.
 */
export function useDragNode<T extends DockableTypes>(
    node: TabOf<T> | TabsetNode<T>,
): UseDragNodeResult {
    const { model } = useDockableContext("useDragNode");
    const { engine } = useLayoutContext("useDragNode");
    const imageRef = React.useRef<HTMLElement | null>(null);
    const dragState = useDragState();
    const id = node.id;
    const enabled = () => engine.adapter.isDraggable(id);

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        if (!enabled()) {
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // a tab drag must not also start a tabset drag
        engine.adapter
            .getDragDropManager()
            .startDrag(
                event.nativeEvent,
                id,
                imageRef.current ?? event.currentTarget,
            );
    };
    const onDragEnd = () => {
        DragDropManager.endDrag();
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        imageRef.current = element;
    }, []);

    return {
        state: {
            // this model's drag only: models of a drag group may share ids
            dragging:
                dragState !== undefined &&
                dragState.subjectOf(model) !== undefined &&
                dragState.dragId === id,
        },
        props: { draggable: enabled(), onDragStart, onDragEnd, ref },
    };
}
