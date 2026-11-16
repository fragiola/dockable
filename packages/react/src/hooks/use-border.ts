import type { BorderNode, DockableTypes } from "@fragiola/dockable";
import type * as React from "react";
import type { BorderContentState } from "../components/border-content";
import { useDockableContext, useLayoutContext } from "../context";
import { useMeasurable, useTabSetDropState } from "./internal";

export interface UseBorderResult {
    /** what the border shows as `data-*` */
    state: BorderContentState;
    /** what goes on the border's strip */
    props: {
        /** callback ref (measured as the border's tab header) */
        ref: React.RefCallback<HTMLElement>;
    };
}

/** The lower layer of `Dockable.Border`: its state, and the props for its strip. */
export function useBorder<T extends DockableTypes>(
    node: BorderNode<T>,
): UseBorderResult {
    const { model } = useDockableContext("useBorder");
    const { engine } = useLayoutContext("useBorder");
    const id = node.id;
    const drop = useTabSetDropState(engine, id);
    const location = node.location;
    const vertical = location === "start" || location === "end";
    const state: BorderContentState = {
        location,
        orientation: vertical ? "vertical" : "horizontal",
        open: node.selected !== -1,
        overlay: model.is("border-overlay", { borderId: id }),
        empty: node.children.length === 0,
        dropTarget: drop.target,
        dropRefused: drop.refused,
    };
    const ref = useMeasurable(engine, id, "borderheader");
    return { state, props: { ref } };
}
