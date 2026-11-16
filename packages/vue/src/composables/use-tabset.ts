// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    DockableTypes,
    DropLocation,
    TabsetNode,
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

/** What goes on a tabset's element. */
export interface TabSetElementProps {
    /** template ref (measured as the tabset) */
    ref: ElementRef;
    /** makes the tabset active on a primary pointer press */
    onPointerdown: (event: PointerEvent) => void;
}

export interface UseTabSetResult {
    /** what the tabset shows as `data-*` */
    state: ComputedRef<TabSetState>;
    /** what goes on the tabset's element */
    props: ComputedRef<TabSetElementProps>;
}

/**
 * The lower layer of `Dockable.TabSet`: its state, and the props for its element (the measurement
 * ref and the activation listener).
 */
export function useTabSet<T extends DockableTypes>(
    node: MaybeRefOrGetter<TabsetNode<T>>,
): UseTabSetResult {
    const { model, revision } = useDockableContext("useTabSet");
    const { engine } = useLayoutContext("useTabSet");
    const id = () => toValue(node).id;
    const drop = useDropState(engine, id);
    const state = computed<TabSetState>(() => {
        revision.value;
        const tabsetId = id();
        const current = drop.value;
        return {
            active: model.is("tabset-active", { tabsetId }),
            maximized: model.is("tabset-maximized", { tabsetId }),
            hidden: model.is("node-hidden-by-maximize", { nodeId: tabsetId }),
            empty: toValue(node).children.length === 0,
            dropTarget: current.target,
            dropLocation: current.location,
            dropRefused: current.refused,
            dropIndex: current.index,
        };
    });
    const ref = useMeasurable(engine, id, "tabset");
    const onPointerdown = (event: PointerEvent) => {
        engine.adapter.handleTabSetPointerDown(id(), event);
    };
    const props = computed<TabSetElementProps>(() => ({ ref, onPointerdown }));
    return { state, props };
}
