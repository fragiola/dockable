// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (the tab strip's ARIA and key shortcuts);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    getTabStripPath,
    type TabNode,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import * as React from "react";
import {
    TabListContext,
    useDockableContext,
    useLayoutContext,
} from "./context";
import { useTabSetDropState } from "./hooks";
import { useTabSetNode } from "./TabSet";
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
}

export interface TabListProps extends DivPrimitiveProps<TabListState> {
    /** renders a tab button (a `Dockable.Tab`) */
    children: (tab: TabNode) => React.ReactNode;
    /** the direction the tabs are laid out in, for arrow key navigation; default horizontal */
    orientation?: "horizontal" | "vertical" | undefined;
}

/**
 * The tabset's tab strip (`role="tablist"`). Calls the child function per tab. Arrow keys along
 * the orientation, Home and End move focus between tabs; Enter or Space selects.
 */
export function TabList(props: TabListProps) {
    const { children, orientation = "horizontal", ...rest } = props;
    const tabset = useTabSetNode("TabList");
    const { keyMap } = useDockableContext("TabList");
    const { engine } = useLayoutContext("TabList");
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.registerMeasurable(tabset, "tabstrip", element);
        },
        [engine, tabset],
    );

    const keyShortcuts =
        [
            toAriaKeyShortcuts(keyMap.focusNextTabset),
            toAriaKeyShortcuts(keyMap.focusPreviousTabset),
        ]
            .filter(Boolean)
            .join(" ") || undefined;

    const drop = useTabSetDropState(engine, tabset.getId());
    const dropIndex = drop.strip ? drop.index : undefined;
    const state: TabListState = {
        orientation,
        dropTarget: drop.strip,
        dropIndex,
    };
    const tabs = tabset
        .getTabNodes()
        .map((tab) => (
            <React.Fragment key={tab.getId()}>{children(tab)}</React.Fragment>
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
                "layout-path": getTabStripPath(tabset),
                orientation,
                "drop-target": state.dropTarget,
                "drop-index": dropIndex,
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
