// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx (APG keyboard handling, roving tab stop, ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    getTabButtonPath,
    type TabOf,
} from "@fragiola/dockable";
import * as React from "react";
import {
    TabListContext,
    useDockableContext,
    useLayoutContext,
} from "../context";
import { useTabHidden } from "../hooks/internal";
import { useDragNode } from "../hooks/use-drag-node";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";

export interface TabState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the tab's tabset is its layout's active tabset (always false in a border) */
    tabsetActive: boolean;
    /** the tab is pinned */
    pinned: boolean;
    /** the tab is being dragged */
    dragging: boolean;
    /** the tab can be popped out into a window */
    poppable: boolean;
    /** the tab does not fit in its strip, so it is hidden (tab overflow) */
    overflowHidden: boolean;
}

export interface TabProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<TabState> {
    node: TabOf<T>;
    /** the tab button's content; the primitive renders no text of its own */
    children?: React.ReactNode;
    /**
     * called when the key map's `renameTab` key (`F2` by default) is pressed on the tab button and
     * the model allows renaming the tab (tabset tabs only): show your rename UI, then run
     * `tab.rename` with the new `label`. Without it the key does nothing.
     */
    onRenameRequest?: ((tab: TabOf<T>) => void) | undefined;
}

/**
 * A tab button (`role="tab"`), following the APG tabs pattern with manual activation: arrow keys
 * (along the tab list's orientation, mirrored in RTL), Home and End move focus; click, Enter or
 * Space selects. Enter or Space on the selected tab moves focus into its panel. Renders only its
 * children.
 */
export function Tab<T extends DockableTypes = AnyTypes>(props: TabProps<T>) {
    const { node, children, onRenameRequest, ...rest } = props;
    const { model } = useDockableContext("Tab");
    const { engine } = useLayoutContext("Tab");
    const { orientation } = React.useContext(TabListContext);
    const id = node.id;

    const drag = useDragNode(node);
    const { ref: dragRef, ...dragProps } = drag.props;
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            dragRef(element); // the tab itself is the drag image
            engine.adapter.registerMeasurable(id, "tabbutton", element);
        },
        [engine, id, dragRef],
    );

    const container = model.get("node-parent-by", { nodeId: id });
    const containerId = container?.id ?? "";
    const selected = model.is("tab-selected", { tabId: id });

    // the core's rules: a press selects (or closes a border's open panel), the APG tab keys and
    // the key map's tab keys
    const onClick = () => {
        engine.adapter.handleTabClick(id);
    };
    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        engine.adapter.handleTabKeyDown(id, event, {
            element: event.currentTarget,
            orientation,
            onRenameRequest: onRenameRequest
                ? () => onRenameRequest(node)
                : undefined,
        });
    };

    const keyShortcuts = engine.adapter.getKeyShortcuts("tab", id, {
        rename: onRenameRequest !== undefined,
    });

    const overflowHidden = useTabHidden(containerId, id);
    const state: TabState = {
        selected,
        tabsetActive: model.is("tab-in-active-tabset", { tabId: id }),
        pinned: node.pinned === true,
        dragging: drag.state.dragging,
        // supported, and the model accepts `tab.popout` for it now
        poppable: engine.can("popout", { nodeId: id }),
        overflowHidden,
    };
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            id: engine.get("tab-button-dom-id-by", { tabId: id }),
            role: "tab",
            "aria-selected": selected,
            "aria-controls": engine.get("tab-panel-dom-id-by", {
                tabId: id,
            }),
            "aria-keyshortcuts": keyShortcuts,
            tabIndex: engine.is("tab-tabbable", { tabId: id }) ? 0 : -1,
            ...dataAttributes({
                "layout-path": getTabButtonPath(
                    engine.get("layout-path-by", { nodeId: id }),
                ),
                selected,
                "tabset-active": state.tabsetActive,
                pinned: state.pinned,
                dragging: state.dragging,
                poppable: state.poppable,
                "overflow-hidden": state.overflowHidden,
            }),
            ...dragProps,
            onClick,
            onKeyDown,
            children,
        },
        // a tab that does not fit is taken out of the strip (tab overflow)
        style: state.overflowHidden ? { display: "none" } : undefined,
    });
}
