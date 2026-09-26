// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx (APG keyboard handling, roving tab stop, ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    Actions,
    BorderNode,
    getTabButtonId,
    getTabButtonPath,
    getTabPanelId,
    hasModifier,
    matchesKey,
    type TabNode,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import * as React from "react";
import {
    TabListContext,
    useDockableContext,
    useLayoutContext,
} from "./context";
import { useDragNode } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface TabState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the tab is pinned */
    pinned: boolean;
    /** the tab is being dragged */
    dragging: boolean;
    /** the tab can be popped out into a window */
    popoutEnabled: boolean;
}

export interface TabProps extends DivPrimitiveProps<TabState> {
    node: TabNode;
    /** the tab button's content; the primitive renders no text of its own */
    children?: React.ReactNode;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** focus the first focusable element in `container`, or the container itself */
function focusFirstIn(container: HTMLElement | null) {
    if (container) {
        const focusable = container.querySelector<HTMLElement>(FOCUSABLE);
        (focusable ?? container).focus();
    }
}

/**
 * A tab button (`role="tab"`), following the APG tabs pattern with manual activation: arrow keys
 * (along the tab list's orientation), Home and End move focus; click, Enter or Space selects.
 * Enter or Space on the selected tab moves focus into its panel. Renders only its children.
 */
export function Tab(props: TabProps) {
    const { node, children, ...rest } = props;
    const { keyMap } = useDockableContext("Tab");
    const { engine } = useLayoutContext("Tab");
    const { orientation } = React.useContext(TabListContext);
    const selfRef = React.useRef<HTMLElement | null>(null);

    const drag = useDragNode(node);
    const dragRef = drag.ref;
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            selfRef.current = element;
            dragRef(element); // the tab itself is the drag image
            engine.registerMeasurable(node, "tabbutton", element);
        },
        [engine, node, dragRef],
    );

    const container = node.getTabContainer();
    const selected = node.isSelected();
    // keep exactly one tab stop in the tablist even when the tabset has no selected tab
    const tabbable =
        selected ||
        (container.getSelectedNode() === undefined &&
            container.getTabNodes()[0] === node);

    const inBorder = container instanceof BorderNode;
    const select = () => {
        if (!node.isSelected()) {
            engine.doAction(Actions.selectTab(node.getId()));
        }
    };
    // a click on a border's selected tab closes the border's panel (FlexLayout's toggle)
    const onClick = () => {
        if (inBorder) {
            engine.doAction(Actions.selectTab(node.getId()));
        } else {
            select();
        }
    };

    const focusAdjacentTab = (to: number | "first" | "last") => {
        const self = selfRef.current;
        const tablist = self?.closest('[role="tablist"]');
        if (!self || !tablist) {
            return false;
        }
        const tabs = Array.from(
            tablist.querySelectorAll<HTMLElement>('[role="tab"]'),
        );
        const next =
            to === "first"
                ? tabs[0]
                : to === "last"
                  ? tabs[tabs.length - 1]
                  : tabs[tabs.indexOf(self) + to];
        next?.focus();
        return next !== undefined;
    };

    // move focus into the tab content: the first focusable element, or the panel itself
    const focusTabContent = () => {
        const doc = selfRef.current?.ownerDocument;
        if (!doc) {
            return;
        }
        const focusPanel = () =>
            focusFirstIn(doc.getElementById(getTabPanelId(node)));
        if (node.isSelected()) {
            focusPanel();
        } else {
            select(); // select first, focus once the panel is shown
            doc.defaultView?.requestAnimationFrame(focusPanel);
        }
    };

    const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.defaultPrevented) {
            return;
        }
        if (matchesKey(event, keyMap.focusTabToggle)) {
            focusTabContent();
            event.preventDefault();
        } else if (event.key === "Enter" || event.key === " ") {
            if (node.isSelected()) {
                focusTabContent(); // activating an already selected tab enters its content
            } else {
                select();
            }
            event.preventDefault();
        } else if (matchesKey(event, keyMap.closeTab) && node.isCloseable()) {
            // move focus to a neighbour before this tab is removed (the previous one for the last)
            if (!focusAdjacentTab(1)) {
                focusAdjacentTab(-1);
            }
            engine.doAction(Actions.deleteTab(node.getId()));
            event.preventDefault();
        } else if (hasModifier(event)) {
            // modified arrows are left for keymap bindings (e.g. tabset cycling)
        } else if (event.key === previousKey) {
            focusAdjacentTab(-1);
            event.preventDefault();
        } else if (event.key === nextKey) {
            focusAdjacentTab(1);
            event.preventDefault();
        } else if (event.key === "Home") {
            focusAdjacentTab("first");
            event.preventDefault();
        } else if (event.key === "End") {
            focusAdjacentTab("last");
            event.preventDefault();
        }
    };

    const keyShortcuts =
        [
            toAriaKeyShortcuts(keyMap.focusTabToggle),
            node.isCloseable()
                ? toAriaKeyShortcuts(keyMap.closeTab)
                : undefined,
        ]
            .filter(Boolean)
            .join(" ") || undefined;

    const state: TabState = {
        selected,
        pinned: node.isPinned(),
        dragging: drag.dragging,
        popoutEnabled: node.isEnablePopout() && engine.isSupportsPopout(),
    };
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            id: getTabButtonId(node),
            role: "tab",
            "aria-selected": selected,
            "aria-controls": getTabPanelId(node),
            "aria-keyshortcuts": keyShortcuts,
            tabIndex: tabbable ? 0 : -1,
            ...dataAttributes({
                "layout-path": getTabButtonPath(node),
                selected,
                pinned: state.pinned,
                dragging: state.dragging,
                "popout-enabled": state.popoutEnabled,
            }),
            draggable: drag.draggable,
            onDragStart: drag.onDragStart,
            onDragEnd: drag.onDragEnd,
            onClick,
            onKeyDown,
            children,
        },
    });
}
