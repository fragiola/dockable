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
import { useTabSetNode } from "./TabSet";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface TabListState {
    orientation: "horizontal" | "vertical";
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

    const state: TabListState = { orientation };
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
