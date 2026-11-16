import type {
    AnyTypes,
    DockableTypes,
    TabContainer,
    TabOf,
} from "@fragiola/dockable";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { useLayoutContext } from "../context";
import { useExternal } from "../utils/render";

export interface UseTabOverflowResult<T extends DockableTypes = AnyTypes> {
    /** some of the container's tabs do not fit, so they are hidden */
    overflowing: ComputedRef<boolean>;
    /** the hidden tabs, in model order: what an overflow menu lists */
    hiddenTabs: ComputedRef<TabOf<T>[]>;
}

/**
 * Tab overflow of a tabset or a border: which of its tabs are hidden because they do not fit in
 * its `Dockable.TabList` (the engine measures the list, the tabs and the
 * `Dockable.TabOverflowTrigger`). The selected tab is never hidden.
 */
export function useTabOverflow<T extends DockableTypes>(
    container: MaybeRefOrGetter<TabContainer<T>>,
): UseTabOverflowResult<T> {
    const { engine } = useLayoutContext("useTabOverflow");
    const hiddenIds = useExternal(engine.adapter.subscribeOverflow, () =>
        engine.adapter.getHiddenTabs(toValue(container).id),
    );
    return {
        overflowing: computed(() => hiddenIds.value.length > 0),
        hiddenTabs: computed(() =>
            toValue(container).children.filter((tab) =>
                hiddenIds.value.includes(tab.id),
            ),
        ),
    };
}
