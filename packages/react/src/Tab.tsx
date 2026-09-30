// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx (APG keyboard handling, roving tab stop, ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    getTabButtonPath,
    hasModifier,
    matchesKey,
    type TabOf,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import * as React from "react";
import {
    TabListContext,
    useDockableContext,
    useLayoutContext,
} from "./context";
import { useDragNode, useTabHidden } from "./hooks";
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
    /** the tab does not fit in its strip, so it is hidden (tab overflow) */
    overflowHidden: boolean;
}

export interface TabProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<TabState> {
    node: TabOf<T>;
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
export function Tab<T extends DockableTypes = AnyTypes>(props: TabProps<T>) {
    const { node, children, ...rest } = props;
    const { keyMap, model } = useDockableContext("Tab");
    const { engine } = useLayoutContext("Tab");
    const { orientation } = React.useContext(TabListContext);
    const selfRef = React.useRef<HTMLElement | null>(null);
    const id = node.id;

    const drag = useDragNode(node);
    const dragRef = drag.ref;
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            selfRef.current = element;
            dragRef(element); // the tab itself is the drag image
            engine.registerMeasurable(id, "tabbutton", element);
        },
        [engine, id, dragRef],
    );

    const container = model.parentOf(id);
    const containerId = container?.id ?? "";
    const isSelected = () => model.selectedTab(containerId)?.id === id;
    const selected = isSelected();
    // keep exactly one tab stop in the tablist even when the tabset has no selected tab
    const tabbable =
        selected ||
        (container?.type !== "row" &&
            container?.selected === -1 &&
            container.children[0]?.id === id);

    const inBorder = container?.type === "border";
    const select = () => {
        if (!isSelected()) {
            engine.run("tab.select", { tab: id });
        }
    };
    // a click on a border's selected tab closes the border's panel (FlexLayout's toggle)
    const onClick = () => {
        if (inBorder && isSelected()) {
            engine.run("border.configure", {
                border: containerId,
                open: false,
            });
        } else {
            select();
        }
    };
    const closeable = () => model.can("tab.close", { tab: id }).ok;

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
        if (next?.hasAttribute("data-overflow-hidden")) {
            // a tab hidden by tab overflow: select it, which brings it into the strip, then focus it
            const target = model
                .parentOf(id)
                ?.children.find(
                    (tab) =>
                        tab.type === "tab" &&
                        engine.tabButtonId(tab.id) === next.id,
                );
            if (target) {
                engine.run("tab.select", { tab: target.id });
                self.ownerDocument.defaultView?.requestAnimationFrame(() =>
                    self.ownerDocument.getElementById(next.id)?.focus(),
                );
            }
            return true;
        }
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
            focusFirstIn(doc.getElementById(engine.tabPanelId(id)));
        if (isSelected()) {
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
            if (isSelected()) {
                focusTabContent(); // activating an already selected tab enters its content
            } else {
                select();
            }
            event.preventDefault();
        } else if (matchesKey(event, keyMap.closeTab) && closeable()) {
            // move focus to a neighbour before this tab is removed (the previous one for the last)
            if (!focusAdjacentTab(1)) {
                focusAdjacentTab(-1);
            }
            engine.run("tab.close", { tab: id });
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
            // the hint follows the tab's own rule; the key itself asks the model (`closeable`)
            model.resolve(node).enableClose && node.pinned !== true
                ? toAriaKeyShortcuts(keyMap.closeTab)
                : undefined,
        ]
            .filter(Boolean)
            .join(" ") || undefined;

    const overflowHidden = useTabHidden(containerId, id);
    const state: TabState = {
        selected,
        pinned: node.pinned === true,
        dragging: drag.dragging,
        // supported, and the model accepts `tab.popout` for it now
        popoutEnabled: engine.canPopout(id),
        overflowHidden,
    };
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            id: engine.tabButtonId(id),
            role: "tab",
            "aria-selected": selected,
            "aria-controls": engine.tabPanelId(id),
            "aria-keyshortcuts": keyShortcuts,
            tabIndex: tabbable ? 0 : -1,
            ...dataAttributes({
                "layout-path": getTabButtonPath(engine.path(id)),
                selected,
                pinned: state.pinned,
                dragging: state.dragging,
                "popout-enabled": state.popoutEnabled,
                "overflow-hidden": state.overflowHidden,
            }),
            draggable: drag.draggable,
            onDragStart: drag.onDragStart,
            onDragEnd: drag.onDragEnd,
            onClick,
            onKeyDown,
            children,
        },
        // a tab that does not fit is taken out of the strip (tab overflow)
        style: state.overflowHidden ? { display: "none" } : undefined,
    });
}
