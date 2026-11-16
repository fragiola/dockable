import {
    type AnyTypes,
    type DockableTypes,
    DragDropManager,
    type DropZoneOptions,
    type Model,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    shallowRef,
    toValue,
} from "vue";
import { type ElementRef, elementRef } from "../utils/render";
import { useDragState } from "./internal";

export interface DropZoneState {
    /** a drag the zone takes is over it */
    over: boolean;
    /** a drag the zone would take is in progress */
    active: boolean;
}

export interface UseDropZoneOptions<T extends DockableTypes = AnyTypes> {
    /** the model whose drags the zone takes */
    model: Model<T>;
    /** whether the zone takes this drag (default: every drag of the model) */
    accepts?: DropZoneOptions<T>["accepts"];
    /**
     * called when the drag is dropped on the zone, with what is dragged: `{ kind: "tab", tab }`,
     * `{ kind: "tabset", tabset }` or, for a new tab (a `Dockable.DragSource` or a foreign drag),
     * `{ kind: "new", tab }`. Nothing is moved: run the command you want (`tab.close`).
     */
    onDrop: DropZoneOptions<T>["onDrop"];
}

export interface UseDropZoneResult {
    state: ComputedRef<DropZoneState>;
    /** what goes on the zone's element */
    props: ComputedRef<{
        /** template ref */
        ref: ElementRef;
    }>;
}

/**
 * The lower layer of `Dockable.DropZone`: makes an element, inside or outside the layout, a place
 * where a drag of the layout can be dropped for the consumer to handle (a trash can, an "open to
 * the right" pad). Bind `props` on the element.
 */
export function useDropZone<T extends DockableTypes>(
    options: MaybeRefOrGetter<UseDropZoneOptions<T>>,
): UseDropZoneResult {
    const over = shallowRef(false);
    const dragState = useDragState();
    const ref = elementRef(
        (element) => {
            const model = toValue(options).model;
            const unregister = DragDropManager.registerDropZone(
                model,
                element,
                {
                    accepts: (drag) => toValue(options).accepts?.(drag) ?? true,
                    onDrop: (drag, event) =>
                        toValue(options).onDrop(drag, event),
                    onOverChange: (value) => {
                        over.value = value;
                    },
                },
            );
            return () => {
                unregister();
                over.value = false;
            };
        },
        () => [toValue(options).model],
    );
    return {
        state: computed(() => {
            const { model, accepts } = toValue(options);
            const subject = dragState.value?.subjectOf(model);
            const active =
                subject !== undefined && (accepts?.(subject) ?? true);
            return { over: over.value && active, active };
        }),
        props: computed(() => ({ ref })),
    };
}
