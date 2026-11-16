import type {
    AnyTypes,
    DockableTypes,
    TabContainer,
    TabOf,
} from "@fragiola/dockable";
import * as React from "react";
import { useLayoutContext } from "../context";

export interface UseTabOverflowResult<T extends DockableTypes = AnyTypes> {
    /** some of the container's tabs do not fit, so they are hidden */
    overflowing: boolean;
    /** the hidden tabs, in model order: what an overflow menu lists */
    hiddenTabs: TabOf<T>[];
}

/**
 * Tab overflow of a tabset or a border: which of its tabs are hidden because they do not fit in
 * its `Dockable.TabList` (the engine measures the list, the tabs and the
 * `Dockable.TabOverflowTrigger`). The selected tab is never hidden.
 */
export function useTabOverflow<T extends DockableTypes>(
    container: TabContainer<T>,
): UseTabOverflowResult<T> {
    const { engine } = useLayoutContext("useTabOverflow");
    const id = container.id;
    const hiddenIds = React.useSyncExternalStore(
        engine.adapter.subscribeOverflow,
        () => engine.adapter.getHiddenTabs(id),
        () => engine.adapter.getHiddenTabs(id),
    );
    return {
        overflowing: hiddenIds.length > 0,
        hiddenTabs: container.children.filter((tab) =>
            hiddenIds.includes(tab.id),
        ),
    };
}
