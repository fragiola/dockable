import type { AnyTypes, DockableTypes, TabOf } from "@fragiola/dockable";
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

export interface PopoutTriggerProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps<PopoutTriggerState>,
        ButtonProps {
    /** `"tab"` (default) pops out one tab; `"tabset"` pops out the whole tabset */
    target?: "tab" | "tabset" | undefined;
    /** the tab to act on; default: the enclosing tabset's selected tab */
    node?: TabOf<T> | undefined;
    /** the button's content (an icon); the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * A button, inside `Dockable.TabSet`, that pops the selected tab (or the whole tabset) out into a
 * window, and, in a window, docks it back into the main layout. It renders nothing when neither
 * is possible (popouts unsupported, the model refuses it, no tab): `tab.popout` / `tabset.popout`
 * decide, through `model.can`. It has no name of its own: give it an `aria-label`, or name it
 * from the state when the two actions need different names
 * (`render={(props, state) => <button {...props} aria-label={state.mode === "dock" ? … : …} />}`).
 */
export function PopoutTrigger<T extends DockableTypes = AnyTypes>(
    props: PopoutTriggerProps<T>,
) {
    const { target = "tab", node, children, ...rest } = props;
    const tabset = useTabSetNode("PopoutTrigger");
    const { model } = useDockableContext("PopoutTrigger");
    const { engine } = useLayoutContext("PopoutTrigger");

    const subject =
        target === "tabset"
            ? tabset.id
            : (node?.id ??
              model.get("selected-tab-by", { tabsetId: tabset.id })?.id);
    const mode: PopoutTriggerState["mode"] | undefined =
        subject === undefined
            ? undefined
            : model.is("node-in-window", { nodeId: subject })
              ? "dock"
              : engine.can("popout", { nodeId: subject })
                ? "popout"
                : undefined;

    const onClick = () => {
        if (!subject || !mode) {
            return;
        }
        if (mode === "dock") {
            engine.run("dock-back", { nodeId: subject });
        } else {
            engine.run("popout", { nodeId: subject });
        }
    };

    const state: PopoutTriggerState = { mode: mode ?? "popout", target };
    const element = useRenderElement("button", rest, {
        state,
        props: {
            type: "button",
            ...dataAttributes({
                // FlexLayout's path for a tabset's pop out button
                "layout-path": `${engine.get("layout-path-by", { nodeId: tabset.id })}/button/popout`,
                mode: state.mode,
                target,
            }),
            onClick,
            children,
        },
    });
    return mode ? element : null;
}
