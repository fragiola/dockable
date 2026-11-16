// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type DockableTypes,
    DragDropManager,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { useDockableContext, useLayoutContext } from "../context";
import { type ElementRef, elementRef } from "../utils/render";
import { useDragState } from "./internal";

/** What goes on a draggable element. */
export interface DragProps {
    /** whether the element is draggable */
    draggable: boolean;
    onDragstart: (event: DragEvent) => void;
    onDragend: (event: DragEvent) => void;
    /**
     * template ref for the element the browser snapshots as the drag image: the dragged element
     * itself, unless you put it on another one
     */
    ref: ElementRef;
}

export interface UseDragNodeResult {
    state: ComputedRef<{
        /** this node is being dragged */
        dragging: boolean;
    }>;
    /** what goes on the dragged element (`draggable` follows the node's `draggable` setting) */
    props: ComputedRef<DragProps>;
}

/**
 * The lower layer of a draggable part: wires a tab or a tabset to the core's drag-and-drop
 * machine. Bind `props` on the dragged element.
 */
export function useDragNode<T extends DockableTypes>(
    node: MaybeRefOrGetter<TabOf<T> | TabsetNode<T>>,
): UseDragNodeResult {
    const { model, revision } = useDockableContext("useDragNode");
    const { engine } = useLayoutContext("useDragNode");
    let image: HTMLElement | null = null;
    const dragState = useDragState();
    const id = () => toValue(node).id;

    const onDragstart = (event: DragEvent) => {
        const nodeId = id();
        if (!engine.adapter.isDraggable(nodeId)) {
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // a tab drag must not also start a tabset drag
        const target = event.currentTarget;
        engine.adapter
            .getDragDropManager()
            .startDrag(
                event,
                nodeId,
                image ?? (target as HTMLElement | null) ?? undefined,
            );
    };
    const onDragend = () => {
        DragDropManager.endDrag();
    };
    const ref = elementRef((element) => {
        image = element;
        return () => {
            image = null;
        };
    });

    return {
        state: computed(() => {
            const drag = dragState.value;
            return {
                // this model's drag only: models of a drag group may share ids
                dragging:
                    drag !== undefined &&
                    drag.subjectOf(model) !== undefined &&
                    drag.dragId === id(),
            };
        }),
        props: computed(() => {
            revision.value;
            return {
                draggable: engine.adapter.isDraggable(id()),
                onDragstart,
                onDragend,
                ref,
            };
        }),
    };
}
