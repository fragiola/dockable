// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (sizing, activation on pointer down);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    AnyTypes,
    DockableTypes,
    TabContainer,
    TabsetNode,
} from "@fragiola/dockable";
import * as React from "react";
import { typedModel, useDockableContext, useLayoutContext } from "./context";
import { type TabSetState, useTabSet } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export type { TabSetState };

/** The id of the enclosing tabset. */
export const TabSetContext = React.createContext<string | null>(null);

/** The id of the tab container (a tabset or a border) of the parts inside it: `TabList`, `Tab`. */
export const TabContainerContext = React.createContext<string | null>(null);

export function useTabContainer<T extends DockableTypes = AnyTypes>(
    part: string,
): TabContainer<T> {
    const id = React.useContext(TabContainerContext);
    const { model } = useDockableContext(part);
    // the container of the registry the part's caller declares (`<Dockable.TabList<Types>>`)
    const container =
        id === null
            ? undefined
            : typedModel<T>(model).get("node", { node: id });
    if (container?.type !== "tabset" && container?.type !== "border") {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.TabSet or Dockable.Border`,
        );
    }
    return container;
}

export function useTabSetNode(part: string): TabsetNode {
    const id = React.useContext(TabSetContext);
    const { model } = useDockableContext(part);
    const tabset = id === null ? undefined : model.get("node", { node: id });
    if (tabset?.type !== "tabset") {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.TabSet`,
        );
    }
    return tabset;
}

export interface TabSetProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<TabSetState> {
    node: TabsetNode<T>;
    children?: React.ReactNode;
}

/**
 * A tabset: a flex item of its row, sized by its weight. Pressing inside it makes it the active
 * tabset. Place a `Dockable.TabList` and a `Dockable.TabSetContent` inside.
 */
export function TabSet<T extends DockableTypes = AnyTypes>(
    props: TabSetProps<T>,
) {
    const { node, children, ...rest } = props;
    const { engine } = useLayoutContext("TabSet");
    const { state, props: tabset } = useTabSet(node);
    const range = engine.get("size-limits", { node: node.id });

    const element = useRenderElement("div", rest, {
        state,
        ref: tabset.ref,
        props: {
            ...dataAttributes({
                "layout-path": engine.get("path", { node: node.id }),
                active: state.active,
                maximized: state.maximized,
                empty: state.empty,
                "drop-target": state.dropTarget,
                "drop-location": state.dropLocation,
                "drop-refused": state.dropRefused,
            }),
            onPointerDown: tabset.onPointerDown,
            children,
        },
        style: {
            display: state.hidden ? "none" : "flex",
            flexDirection: "column",
            flexBasis: 0,
            // NOTE: flex-grow cannot have values < 1 otherwise it will not fill the parent
            flexGrow: Math.max(1, node.weight * 1000),
            minWidth: range.minWidth,
            minHeight: range.minHeight,
            maxWidth: range.maxWidth,
            maxHeight: range.maxHeight,
            overflow: "hidden",
        },
    });
    return (
        <TabSetContext.Provider value={node.id}>
            <TabContainerContext.Provider value={node.id}>
                {element}
            </TabContainerContext.Provider>
        </TabSetContext.Provider>
    );
}
