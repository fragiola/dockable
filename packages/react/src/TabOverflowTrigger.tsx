import { DockableLabel, type TabNode } from "@fragiola/dockable";
import * as React from "react";
import { useDockableContext, useLayoutContext } from "./context";
import { useTabOverflow } from "./hooks";
import { useTabContainer } from "./TabSet";
import {
    dataAttributes,
    type PrimitiveProps,
    useRenderElement,
} from "./utils/useRender";

export interface TabOverflowTriggerState {
    /** the tabs that do not fit in the strip, in model order: what the menu lists */
    hidden: TabNode[];
    /** how many tabs are hidden */
    hiddenCount: number;
}

type ButtonProps = Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "style" | "children"
>;

export interface TabOverflowTriggerProps
    extends PrimitiveProps<TabOverflowTriggerState>,
        ButtonProps {
    /** the trigger's content (an icon, a count); the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * The button that opens the consumer's menu of hidden tabs, inside `Dockable.TabSet` or
 * `Dockable.Border`, next to the `Dockable.TabList`. It renders only while tabs are hidden, and the
 * engine reserves the space it takes in the strip. It renders no menu: make it your menu's trigger
 * (`render`), list `useTabOverflow(node).hidden` (or the state's `hidden`), and select with
 * `Actions.selectTab`, which brings the tab into the strip.
 */
export function TabOverflowTrigger(props: TabOverflowTriggerProps) {
    const { children, ...rest } = props;
    const container = useTabContainer("TabOverflowTrigger");
    const { getLabel } = useDockableContext("TabOverflowTrigger");
    const { engine } = useLayoutContext("TabOverflowTrigger");
    const { hidden } = useTabOverflow(container);
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.registerOverflowTrigger(container, element);
        },
        [engine, container],
    );
    const state: TabOverflowTriggerState = {
        hidden,
        hiddenCount: hidden.length,
    };
    const element = useRenderElement("button", rest, {
        state,
        ref,
        props: {
            type: "button",
            "aria-label": getLabel?.(DockableLabel.Overflow_Menu_Tooltip),
            ...dataAttributes({
                // FlexLayout's path for a tabset's overflow button
                "layout-path": `${container.getPath()}/button/overflow`,
                count: hidden.length,
            }),
            children,
        },
    });
    return hidden.length > 0 ? element : null;
}
