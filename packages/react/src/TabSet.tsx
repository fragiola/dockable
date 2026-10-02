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

/** The id of the tab container (a tabset or a border) of the parts inside it: `TabList`, `Tab`. */
export const TabContainerContext = React.createContext<string | null>(null);

/** The enclosing tab container, of the registry the part's caller declares (`<Dockable.TabList<Types>>`). */
function useContainerNode<T extends DockableTypes = AnyTypes>(part: string) {
    const id = React.useContext(TabContainerContext);
    const { model } = useDockableContext(part);
    return id === null
        ? undefined
        : typedModel<T>(model).get("node-by", { id });
}

export function useTabContainer<T extends DockableTypes = AnyTypes>(
    part: string,
): TabContainer<T> {
    const container = useContainerNode<T>(part);
    if (container?.type !== "tabset" && container?.type !== "border") {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.TabSet or Dockable.Border`,
        );
    }
    return container;
}

export function useTabSetNode(part: string): TabsetNode {
    const tabset = useContainerNode(part);
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
    const flex = engine.get("flex-by", { nodeId: node.id });

    const element = useRenderElement("div", rest, {
        state,
        ref: tabset.ref,
        props: {
            ...dataAttributes({
                "layout-path": engine.get("layout-path-by", {
                    nodeId: node.id,
                }),
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
            flexGrow: flex.grow,
            minWidth: flex.minWidth,
            minHeight: flex.minHeight,
            maxWidth: flex.maxWidth,
            maxHeight: flex.maxHeight,
            overflow: "hidden",
        },
    });
    return (
        <TabContainerContext.Provider value={node.id}>
            {element}
        </TabContainerContext.Provider>
    );
}
