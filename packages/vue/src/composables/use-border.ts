import type {
    BorderLocation,
    BorderNode,
    DockableTypes,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { useDockableContext, useLayoutContext } from "../context";
import type { ElementRef } from "../utils/render";
import { useDropState, useMeasurable } from "./internal";

/** What a border shows: `Dockable.BorderContent`'s state (`Dockable.Border` adds its tab direction). */
export interface BorderContentState {
    /** the side of the layout the border is on */
    location: BorderLocation;
    /** the direction its tabs run: `"vertical"` for a start or end border */
    orientation: "horizontal" | "vertical";
    /** a tab is selected, so the border's panel is open */
    open: boolean;
    /** the panel opens over the layout (`mode: "overlay"`) instead of beside it */
    overlay: boolean;
    /** the border has no tabs */
    empty: boolean;
    /** the current drag would drop into this border (its strip or its open panel) */
    dropTarget: boolean;
    /** the current drag is over this border, but a drop rule refuses it */
    dropRefused: boolean;
}

export interface UseBorderResult {
    /** what the border shows as `data-*` */
    state: ComputedRef<BorderContentState>;
    /** what goes on the border's strip */
    props: ComputedRef<{
        /** template ref (measured as the border's tab header) */
        ref: ElementRef;
    }>;
}

/** The lower layer of `Dockable.Border`: its state, and the props for its strip. */
export function useBorder<T extends DockableTypes>(
    node: MaybeRefOrGetter<BorderNode<T>>,
): UseBorderResult {
    const { model, revision } = useDockableContext("useBorder");
    const { engine } = useLayoutContext("useBorder");
    const id = () => toValue(node).id;
    const drop = useDropState(engine, id);
    const state = computed<BorderContentState>(() => {
        revision.value;
        const border = toValue(node);
        const location = border.location;
        const vertical = location === "start" || location === "end";
        return {
            location,
            orientation: vertical ? "vertical" : "horizontal",
            open: border.selected !== -1,
            overlay: model.is("border-overlay", { borderId: border.id }),
            empty: border.children.length === 0,
            dropTarget: drop.value.target,
            dropRefused: drop.value.refused,
        };
    });
    const ref = useMeasurable(engine, id, "borderheader");
    return { state, props: computed(() => ({ ref })) };
}
