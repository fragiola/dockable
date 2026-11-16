import { computed, type Signal } from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    TabContainer,
    TabOf,
} from "@fragiola/dockable";
import { injectLayoutContext } from "../context";
import { injectTabContainer } from "../directives/tabset.directive";
import { hiddenTabsSignal } from "../utils/signals";

export interface InjectTabOverflowResult<T extends DockableTypes = AnyTypes> {
    /** some of the container's tabs do not fit, so they are hidden */
    overflowing: Signal<boolean>;
    /** the hidden tabs, in model order: what an overflow menu lists */
    hiddenTabs: Signal<TabOf<T>[]>;
}

/**
 * Tab overflow of a tabset or a border: which of its tabs are hidden because they do not fit in
 * its `[dockableTabList]` (the engine measures the list, the tabs and the
 * `[dockableTabOverflowTrigger]`). The selected tab is never hidden. Default: the enclosing
 * `[dockableTabSet]` or `[dockableBorder]`.
 */
export function injectTabOverflow<T extends DockableTypes = AnyTypes>(
    container?: () => TabContainer<T>,
): InjectTabOverflowResult<T> {
    const layout = injectLayoutContext("injectTabOverflow");
    const current: () => TabContainer<T> =
        container ?? injectTabContainer<T>("injectTabOverflow");
    const hidden = hiddenTabsSignal(layout.engine, () => current().id);
    return {
        overflowing: computed(() => hidden().length > 0),
        hiddenTabs: computed(() =>
            current().children.filter((tab) => hidden().includes(tab.id)),
        ),
    };
}
