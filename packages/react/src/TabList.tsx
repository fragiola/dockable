// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (the tab strip's ARIA and key shortcuts);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    getTabStripPath,
    type TabOf,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import * as React from "react";
import {
    TabListContext,
    useDockableContext,
    useLayoutContext,
} from "./context";
import { useTabOverflow, useTabSetDropState } from "./hooks";
import { useTabContainer } from "./TabSet";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface TabListState {
    orientation: "horizontal" | "vertical";
    /** the current drag would drop into this tab strip */
    dropTarget: boolean;
    /** while it is the drop target: the insertion index in the strip */
    dropIndex: number | undefined;
    /** some tabs do not fit, so they are hidden (list them with `Dockable.TabOverflowTrigger`) */
    overflowing: boolean;
    /** how many tabs are hidden */
    hiddenCount: number;
}

export interface TabListProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<TabListState> {
    /**
     * renders a tab button (a `Dockable.Tab`); pass the model's registry as the type argument
     * (`<Dockable.TabList<Types>>`) and `tab.data` narrows on `tab.component`
     */
    children: (tab: TabOf<T>) => React.ReactNode;
    /**
     * the direction the tabs are laid out in, for arrow key navigation; default horizontal
     * (vertical in a left or right border)
     */
    orientation?: "horizontal" | "vertical" | undefined;
    /**
     * tab overflow: the tabs that do not fit are hidden (the selected one stays), for a
     * `Dockable.TabOverflowTrigger` to list; `false` keeps every tab, for a strip that wraps or
     * scrolls. Default `true`
     */
    overflow?: boolean | undefined;
}

/**
 * The tab strip (`role="tablist"`) of a tabset or a border. Calls the child function per tab.
 * Arrow keys along the orientation, Home and End move focus between tabs; Enter or Space selects.
 */
export function TabList<T extends DockableTypes = AnyTypes>(
    props: TabListProps<T>,
) {
    const container = useTabContainer<T>("TabList");
    const border = container.type === "border";
    const {
        children,
        orientation = border &&
        (container.location === "left" || container.location === "right")
            ? "vertical"
            : "horizontal",
        overflow = true,
        ...rest
    } = props;
    const { keyMap } = useDockableContext("TabList");
    const { engine } = useLayoutContext("TabList");
    const id = container.id;
    const vertical = orientation === "vertical";
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            // a border's strip is measured as a whole by Dockable.Border
            if (!border) {
                engine.adapter.registerMeasurable(id, "tabstrip", element);
            }
            // the tabs that do not fit in the list are hidden (tab overflow)
            engine.adapter.registerTabList(
                id,
                overflow ? element : null,
                vertical,
            );
        },
        [engine, id, border, vertical, overflow],
    );
    const tabOverflow = useTabOverflow(container);

    const keyShortcuts =
        [
            toAriaKeyShortcuts(keyMap.focusNextTabset),
            toAriaKeyShortcuts(keyMap.focusPreviousTabset),
        ]
            .filter(Boolean)
            .join(" ") || undefined;

    const drop = useTabSetDropState(engine, id);
    const state: TabListState = {
        orientation,
        dropTarget: drop.index !== undefined,
        dropIndex: drop.index,
        overflowing: tabOverflow.overflowing,
        hiddenCount: tabOverflow.hiddenTabs.length,
    };
    const tabs = container.children.map((tab) => (
        <React.Fragment key={tab.id}>{children(tab)}</React.Fragment>
    ));
    const listContext = React.useMemo(() => ({ orientation }), [orientation]);

    const element = useRenderElement("div", rest, {
        state,
        ref,
        props: {
            role: "tablist",
            "aria-orientation": orientation,
            "aria-keyshortcuts": keyShortcuts,
            ...dataAttributes({
                "layout-path": getTabStripPath(
                    engine.get("layout-path-by", { nodeId: id }),
                ),
                orientation,
                "drop-target": state.dropTarget,
                "drop-index": state.dropIndex,
                overflowing: state.overflowing,
            }),
            children: tabs,
        },
    });
    return (
        <TabListContext.Provider value={listContext}>
            {element}
        </TabListContext.Provider>
    );
}
