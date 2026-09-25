import type { TabSetNode } from "@fragiola/dockable";
import * as React from "react";
import { type TabSetState, useTabSet } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export type { TabSetState };

export const TabSetContext = React.createContext<TabSetNode | null>(null);

export function useTabSetNode(part: string): TabSetNode {
    const tabset = React.useContext(TabSetContext);
    if (!tabset) {
        throw new Error(
            `Dockable.${part} must be rendered inside Dockable.TabSet`,
        );
    }
    return tabset;
}

export interface TabSetProps extends DivPrimitiveProps<TabSetState> {
    node: TabSetNode;
    children?: React.ReactNode;
}

/**
 * A tabset: a flex item of its row, sized by its weight. Pressing inside it makes it the active
 * tabset. Place a `Dockable.TabList` and a `Dockable.TabSetContent` inside.
 */
export function TabSet(props: TabSetProps) {
    const { node, children, ...rest } = props;
    const { state, ref, onPointerDown } = useTabSet(node);

    const element = useRenderElement("div", rest, {
        state,
        ref,
        props: {
            ...dataAttributes({
                "layout-path": node.getPath(),
                active: state.active,
                maximized: state.maximized,
                empty: state.empty,
            }),
            onPointerDown,
            children,
        },
        style: {
            display: state.hidden ? "none" : "flex",
            flexDirection: "column",
            flexBasis: 0,
            // NOTE: flex-grow cannot have values < 1 otherwise it will not fill the parent
            flexGrow: Math.max(1, node.getWeight() * 1000),
            minWidth: node.getMinWidth(),
            minHeight: node.getMinHeight(),
            maxWidth: node.getMaxWidth(),
            maxHeight: node.getMaxHeight(),
            overflow: "hidden",
        },
    });
    return (
        <TabSetContext.Provider value={node}>{element}</TabSetContext.Provider>
    );
}
