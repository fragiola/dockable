// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { BorderNode } from "@fragiola/dockable";
import type * as React from "react";
import { type BorderState, useBorder } from "./hooks";
import { TabContainerContext } from "./TabSet";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export type { BorderState };

/** the data attributes of a border's state, shared by its strip and its content */
export function borderAttributes(state: BorderState) {
    return {
        location: state.location,
        orientation: state.orientation,
        open: state.open,
        overlay: state.overlay,
        docked: !state.overlay,
        empty: state.empty,
    };
}

export interface BorderProps extends DivPrimitiveProps<BorderState> {
    node: BorderNode;
    /** the strip's content: a `Dockable.TabList`, and any buttons */
    children?: React.ReactNode;
}

/**
 * A border's strip: the bar on one side of the layout that holds its tabs. Place a
 * `Dockable.TabList` inside (it runs vertically in a left or right border). Clicking a tab opens
 * the border's panel; clicking the selected tab closes it. Render it from `Dockable.Borders`'s `renderBar`.
 *
 * The strip is only structural flex: rotating the tab labels of a side border (`writing-mode`, a
 * transform) is styling, and yours.
 */
export function Border(props: BorderProps) {
    const { node, children, ...rest } = props;
    const { state, ref } = useBorder(node);
    const element = useRenderElement("div", rest, {
        state,
        ref,
        props: {
            ...dataAttributes({
                "layout-path": node.getPath(),
                ...borderAttributes(state),
                "tab-direction": state.tabDirection,
                "drop-target": state.dropTarget,
                "drop-refused": state.dropRefused,
            }),
            children,
        },
        style: {
            display: "flex",
            flexDirection: state.orientation === "vertical" ? "column" : "row",
        },
    });
    return (
        <TabContainerContext.Provider value={node}>
            {element}
        </TabContainerContext.Provider>
    );
}
