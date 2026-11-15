// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import { computed, Directive, input, type Signal } from "@angular/core";
import {
    type AnyTypes,
    type DockableTypes,
    DragDropManager,
    type LayoutEngine,
    type Model,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "./context";
import { dragStateSignal } from "./internal";
import { injectHost } from "./utils";

/** What a dragged part shows. */
export interface DragNodeState {
    /** this node is being dragged */
    dragging: boolean;
}

/**
 * The drag wiring of a tab or a tabset: whether it can be dragged, its state, and the
 * listeners a directive binds on its element (which is the drag image)
 */
export class DragNodeBinding {
    private readonly dragState = dragStateSignal();

    readonly state: Signal<DragNodeState>;
    readonly draggable: Signal<boolean>;

    constructor(
        private readonly context: DockableContext,
        private readonly engine: Signal<LayoutEngine>,
        private readonly model: Signal<Model>,
        private readonly id: () => string,
        private readonly image: HTMLElement,
    ) {
        this.state = computed(() => {
            const drag = this.dragState();
            return {
                // this model's drag only: models of a drag group may share ids
                dragging:
                    drag !== undefined &&
                    drag.subjectOf(this.model()) !== undefined &&
                    drag.dragId === this.id(),
            };
        });
        this.draggable = computed(() => {
            this.context.revision();
            return this.engine().adapter.isDraggable(this.id());
        });
    }

    onDragStart(event: DragEvent): void {
        const nodeId = this.id();
        const engine = this.engine();
        if (!engine.adapter.isDraggable(nodeId)) {
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // a tab drag must not also start a tabset drag
        engine.adapter
            .getDragDropManager()
            .startDrag(event, nodeId, this.image);
    }

    onDragEnd(): void {
        DragDropManager.endDrag();
    }
}

/**
 * Makes its element the drag handle of a tab or a tabset (`<div [dockableDragNode]="tabset">`):
 * dragging it moves the node, through the core's drag-and-drop machine. `draggable` follows the
 * node's `draggable` setting; the element is the drag image. A `[dockableTab]` is already its tab's
 * handle. (The Angular form of React's `useDragNode`.)
 */
@Directive({
    selector: "[dockableDragNode]",
    exportAs: "dockableDragNode",
    host: {
        "[attr.draggable]": "binding.draggable()",
        "[attr.data-dragging]": "binding.state().dragging ? '' : null",
        "(dragstart)": "binding.onDragStart($event)",
        "(dragend)": "binding.onDragEnd()",
    },
})
export class DockableDragNode<T extends DockableTypes = AnyTypes> {
    /** the tab or tabset dragged from this element */
    readonly dockableDragNode = input.required<TabOf<T> | TabsetNode<T>>();

    private readonly context = injectDockableContext("[dockableDragNode]");
    protected readonly binding = new DragNodeBinding(
        this.context,
        injectLayoutContext("[dockableDragNode]").engine,
        this.context.model,
        () => this.dockableDragNode().id,
        injectHost(),
    );

    /** whether the node is being dragged */
    readonly state: Signal<DragNodeState> = this.binding.state;
}
