import {
    type AnyTypes,
    type DockableTypes,
    DragDropManager,
    type DragState,
    type Model,
    type NewTabDropped,
    type TabInitOf,
} from "@fragiola/dockable";
import * as React from "react";
import { useDragState } from "./internal";
import type { DragProps } from "./use-drag-node";

export interface UseDragSourceOptions<T extends DockableTypes = AnyTypes> {
    /** the model of the layout the new tab is dropped into (its `Dockable.Root` must be mounted) */
    model: Model<T>;
    /**
     * the tab a drop creates (a `tab.add` init, checked against the registry). A function is called
     * at each drag start, so every drop can get fresh data.
     */
    tab: TabInitOf<T> | (() => TabInitOf<T>);
    /** called after the drop with the new tab's id, or `undefined` when the add was refused */
    onDrop?: NewTabDropped | undefined;
    /** no drag starts while true */
    disabled?: boolean | undefined;
}

export interface UseDragSourceResult {
    state: {
        /** a drag started by this source is in progress */
        dragging: boolean;
    };
    /** what goes on the source element (`draggable` is false while `disabled`) */
    props: DragProps;
}

/**
 * The lower layer of `Dockable.DragSource`: turns any element, inside or outside the layout (a
 * sidebar item, a palette entry), into a source of new tabs. Dropping it on the layout runs
 * `tab.add` through the model's middleware. Spread `props` on the element.
 */
export function useDragSource<T extends DockableTypes>(
    options: UseDragSourceOptions<T>,
): UseDragSourceResult {
    const { model, tab, onDrop, disabled = false } = options;
    const imageRef = React.useRef<HTMLElement | null>(null);
    const started = React.useRef<DragState | undefined>(undefined);
    const dragState = useDragState();

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        if (
            disabled ||
            !DragDropManager.startAddDrag(
                model,
                event.nativeEvent,
                typeof tab === "function" ? tab() : tab,
                onDrop,
                imageRef.current ?? event.currentTarget,
            )
        ) {
            // no layout to drop into (not mounted yet): no native drag either
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // an enclosing draggable must not start its own drag
        started.current = DragDropManager.getDragState();
    };
    const onDragEnd = () => {
        if (
            started.current !== undefined &&
            DragDropManager.getDragState() === started.current
        ) {
            DragDropManager.endDrag();
        }
        started.current = undefined;
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        imageRef.current = element;
    }, []);

    return {
        state: {
            dragging: dragState !== undefined && dragState === started.current,
        },
        props: { draggable: !disabled, onDragStart, onDragEnd, ref },
    };
}
