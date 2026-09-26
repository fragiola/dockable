import { DockableLabel, type TabNode } from "@fragiola/dockable";
import type * as React from "react";
import { useDockableContext, useLayoutContext } from "./context";
import { useTabSetNode } from "./TabSet";
import {
    dataAttributes,
    type PrimitiveProps,
    useRenderElement,
} from "./utils/useRender";

export interface PopoutTriggerState {
    /** what a press does: open a window (`"popout"`) or dock back into the main layout (`"dock"`) */
    mode: "popout" | "dock";
    /** what it acts on: the selected tab (or `node`), or the whole tabset */
    target: "tab" | "tabset";
}

type ButtonProps = Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "style" | "children"
>;

export interface PopoutTriggerProps
    extends PrimitiveProps<PopoutTriggerState>,
        ButtonProps {
    /** `"tab"` (default) pops out one tab; `"tabset"` pops out the whole tabset */
    target?: "tab" | "tabset" | undefined;
    /** the tab to act on; default: the enclosing tabset's selected tab */
    node?: TabNode | undefined;
    /** the button's content (an icon); the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * A button, inside `Dockable.TabSet`, that pops the selected tab (or the whole tabset) out into a
 * window, and, in a window, docks it back into the main layout. It renders nothing when neither
 * is possible (popouts unsupported, the tab disables popout, no tab). Its accessible name comes
 * from `aria-label` or `getLabel` (`Popout_Tab` / `Dock_Float_To_Layout`).
 */
export function PopoutTrigger(props: PopoutTriggerProps) {
    const { target = "tab", node, children, ...rest } = props;
    const tabset = useTabSetNode("PopoutTrigger");
    const { getLabel } = useDockableContext("PopoutTrigger");
    const { engine } = useLayoutContext("PopoutTrigger");

    const subject =
        target === "tabset"
            ? tabset
            : (node ?? (tabset.getSelectedNode() as TabNode | undefined));
    const mode: PopoutTriggerState["mode"] | undefined =
        subject === undefined
            ? undefined
            : engine.isInWindow(subject)
              ? "dock"
              : engine.canPopout(subject)
                ? "popout"
                : undefined;

    const onClick = () => {
        if (!subject || !mode) {
            return;
        }
        if (mode === "dock") {
            engine.dockBack(subject);
        } else {
            engine.popout(subject);
        }
    };

    const state: PopoutTriggerState = { mode: mode ?? "popout", target };
    const element = useRenderElement("button", rest, {
        state,
        props: {
            type: "button",
            "aria-label": getLabel?.(
                mode === "dock"
                    ? DockableLabel.Dock_Float_To_Layout
                    : DockableLabel.Popout_Tab,
            ),
            ...dataAttributes({
                // FlexLayout's path for a tabset's pop out button
                "layout-path": `${tabset.getPath()}/button/popout`,
                mode: state.mode,
                target,
            }),
            onClick,
            children,
        },
    });
    return mode ? element : null;
}
