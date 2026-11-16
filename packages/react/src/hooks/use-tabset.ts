// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    DockableTypes,
    DropLocation,
    TabsetNode,
} from "@fragiola/dockable";
import type * as React from "react";
import { useDockableContext, useLayoutContext } from "../context";
import { useMeasurable, useTabSetDropState } from "./internal";

export interface TabSetState {
    /** the tabset is its layout's active tabset */
    active: boolean;
    /** the tabset is maximized */
    maximized: boolean;
    /** another tabset of the layout is maximized, so this one is hidden */
    hidden: boolean;
    /** the tabset has no tabs */
    empty: boolean;
    /** the current drag would drop into or beside this tabset (its content or its strip) */
    dropTarget: boolean;
    /** while it is the drop target: where the drag would dock relative to it */
    dropLocation: DropLocation | undefined;
    /** the current drag is over this tabset, but a drop rule refuses it */
    dropRefused: boolean;
    /**
     * while the drag aims at this tabset's strip: the index among its tabs the tab would be
     * inserted at (its length for the end), else `undefined`
     */
    dropIndex: number | undefined;
}

export interface UseTabSetResult {
    /** what the tabset shows as `data-*` */
    state: TabSetState;
    /** what goes on the tabset's element */
    props: {
        /** callback ref (measured as the tabset) */
        ref: React.RefCallback<HTMLElement>;
        /** makes the tabset active on a primary pointer press */
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    };
}

/**
 * The lower layer of `Dockable.TabSet`: its state, and the props for its element (the measurement
 * ref and the activation handler).
 */
export function useTabSet<T extends DockableTypes>(
    node: TabsetNode<T>,
): UseTabSetResult {
    const { model } = useDockableContext("useTabSet");
    const { engine } = useLayoutContext("useTabSet");
    const id = node.id;
    const drop = useTabSetDropState(engine, id);
    const state: TabSetState = {
        active: model.is("tabset-active", { tabsetId: id }),
        maximized: model.is("tabset-maximized", { tabsetId: id }),
        hidden: model.is("node-hidden-by-maximize", { nodeId: id }),
        empty: node.children.length === 0,
        dropTarget: drop.target,
        dropLocation: drop.location,
        dropRefused: drop.refused,
        dropIndex: drop.index,
    };
    const ref = useMeasurable(engine, id, "tabset");
    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        engine.adapter.handleTabSetPointerDown(id, event);
    };
    return { state, props: { ref, onPointerDown } };
}
