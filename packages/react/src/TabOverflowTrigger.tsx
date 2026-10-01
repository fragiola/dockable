import type { AnyTypes, DockableTypes, TabOf } from "@fragiola/dockable";
import * as React from "react";
import { useLayoutContext } from "./context";
import { useTabOverflow } from "./hooks";
import { useTabContainer } from "./TabSet";
import {
    dataAttributes,
    type PrimitiveProps,
    useRenderElement,
} from "./utils/useRender";

export interface TabOverflowTriggerState<T extends DockableTypes = AnyTypes> {
    /** the tabs that do not fit in the strip, in model order: what the menu lists */
    hiddenTabs: TabOf<T>[];
    /** how many tabs are hidden */
    hiddenCount: number;
}

type ButtonProps = Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "style" | "children"
>;

export interface TabOverflowTriggerProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps<TabOverflowTriggerState<T>>,
        ButtonProps {
    /** the trigger's content (an icon, a count); the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * The button that opens the consumer's menu of hidden tabs, inside `Dockable.TabSet` or
 * `Dockable.Border`, next to the `Dockable.TabList`. It renders only while tabs are hidden, and the
 * engine reserves the space it takes in the strip. It renders no menu: make it your menu's trigger
 * (`render`), list `useTabOverflow(node).hiddenTabs` (or the state's `hiddenTabs`, typed with
 * `<Dockable.TabOverflowTrigger<Types>>`), and select with `tab.select`, which brings the tab into
 * the strip. It has no name of its own: give it an `aria-label`.
 */
export function TabOverflowTrigger<T extends DockableTypes = AnyTypes>(
    props: TabOverflowTriggerProps<T>,
) {
    const { children, ...rest } = props;
    const container = useTabContainer<T>("TabOverflowTrigger");
    const { engine } = useLayoutContext("TabOverflowTrigger");
    const { hiddenTabs } = useTabOverflow(container);
    const id = container.id;
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.adapter.registerOverflowTrigger(id, element);
        },
        [engine, id],
    );
    const state: TabOverflowTriggerState<T> = {
        hiddenTabs,
        hiddenCount: hiddenTabs.length,
    };
    const element = useRenderElement("button", rest, {
        state,
        ref,
        props: {
            type: "button",
            ...dataAttributes({
                // FlexLayout's path for a tabset's overflow button
                "layout-path": `${engine.get("layout-path-by-node-id", { nodeId: id })}/button/overflow`,
                count: hiddenTabs.length,
            }),
            children,
        },
    });
    return hiddenTabs.length > 0 ? element : null;
}
