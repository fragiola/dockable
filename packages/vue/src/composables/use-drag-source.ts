import {
    type AnyTypes,
    type DockableTypes,
    DragDropManager,
    type DragState,
    type Model,
    type NewTabDropped,
    type TabInitOf,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    shallowRef,
    toValue,
} from "vue";
import { elementRef } from "../utils/render";
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
    state: ComputedRef<{
        /** a drag started by this source is in progress */
        dragging: boolean;
    }>;
    /** what goes on the source element (`draggable` is false while `disabled`) */
    props: ComputedRef<DragProps>;
}

/**
 * The lower layer of `Dockable.DragSource`: turns any element, inside or outside the layout (a
 * sidebar item, a palette entry), into a source of new tabs. Dropping it on the layout runs
 * `tab.add` through the model's middleware. Bind `props` on the element.
 */
export function useDragSource<T extends DockableTypes>(
    options: MaybeRefOrGetter<UseDragSourceOptions<T>>,
): UseDragSourceResult {
    let image: HTMLElement | null = null;
    const started = shallowRef<DragState | undefined>(undefined);
    const dragState = useDragState();

    const onDragstart = (event: DragEvent) => {
        const { model, tab, onDrop, disabled } = toValue(options);
        const target = event.currentTarget as HTMLElement | null;
        if (
            disabled === true ||
            !DragDropManager.startAddDrag(
                model,
                event,
                typeof tab === "function" ? tab() : tab,
                onDrop,
                image ?? target ?? undefined,
            )
        ) {
            // no layout to drop into (not mounted yet): no native drag either
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // an enclosing draggable must not start its own drag
        started.value = DragDropManager.getDragState();
    };
    const onDragend = () => {
        if (
            started.value !== undefined &&
            DragDropManager.getDragState() === started.value
        ) {
            DragDropManager.endDrag();
        }
        started.value = undefined;
    };
    const ref = elementRef((element) => {
        image = element;
        return () => {
            image = null;
        };
    });

    return {
        state: computed(() => ({
            dragging:
                dragState.value !== undefined &&
                dragState.value === started.value,
        })),
        props: computed(() => ({
            draggable: toValue(options).disabled !== true,
            onDragstart,
            onDragend,
            ref,
        })),
    };
}
