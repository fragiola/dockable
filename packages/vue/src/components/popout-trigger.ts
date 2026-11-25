import type { AnyTypes, DockableTypes, TabOf } from "@fragiola/dockable";
import { useDockableContext, useLayoutContext } from "../context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    dataAttributes,
    type RenderSlot,
    renderElement,
} from "../utils/render";
import { useTabContainer } from "./tabset";

export interface PopoutTriggerState {
    /** what a press does: open a window (`"popout"`) or dock back into the main layout (`"dock"`) */
    mode: "popout" | "dock";
    /** what it acts on: the selected tab (or `node`), or the whole tabset */
    target: "tab" | "tabset";
}

export interface PopoutTriggerProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    /**
     * `"tab"` (default) pops out one tab; `"tabset"` pops out the whole tabset (not in a border:
     * there the trigger renders nothing)
     */
    target?: "tab" | "tabset" | undefined;
    /** the tab to act on; default: the enclosing tabset's (or border's) selected tab */
    node?: TabOf<T> | undefined;
}

export interface PopoutTriggerSlots extends RenderSlot<PopoutTriggerState> {
    /** the button's content (an icon); the primitive renders no text of its own */
    default?: SlotFunction<{ state: PopoutTriggerState }>;
}

/**
 * A button, inside `Dockable.TabSet` or `Dockable.Border`, that pops the selected tab (or the
 * whole tabset) out into a window, and, in a window, docks it back into the main layout. It
 * renders nothing when neither is possible (popouts unsupported, the model refuses it, no tab): `tab.popout` / `tabset.popout`
 * decide, through `model.can`. It has no name of its own: give it an `aria-label`, or name it
 * from the state in the `render` slot when the two actions need different names.
 */
export const PopoutTrigger: DockableComponent<
    PopoutTriggerProps,
    PopoutTriggerSlots
> = definePrimitive<PopoutTriggerProps, PopoutTriggerSlots>(
    "PopoutTrigger",
    ["target", "node", "as"],
    (props, { attrs, slots }) => {
        const container = useTabContainer("PopoutTrigger");
        const { model, revision } = useDockableContext("PopoutTrigger");
        const { engine } = useLayoutContext("PopoutTrigger");
        const subject = () => {
            const { id, type } = container.value;
            if ((props.target ?? "tab") === "tabset") {
                // a border is not a tabset: it has no window of its own
                return type === "border" ? undefined : id;
            }
            return (
                props.node?.id ??
                model.get(
                    "selected-tab-by",
                    type === "border" ? { borderId: id } : { tabsetId: id },
                )?.id
            );
        };
        const modeOf = (nodeId: string | undefined) =>
            nodeId === undefined
                ? undefined
                : engine.get("popout-mode-by", { nodeId });
        const onClick = () => {
            const nodeId = subject();
            const mode = modeOf(nodeId);
            if (!nodeId || !mode) {
                return;
            }
            if (mode === "dock") {
                engine.run("dock-back", { nodeId });
            } else {
                engine.run("popout", { nodeId });
            }
        };
        return () => {
            revision.value;
            const target = props.target ?? "tab";
            const mode = modeOf(subject());
            if (!mode) {
                return null;
            }
            const state: PopoutTriggerState = { mode, target };
            return renderElement({
                tag: "button",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: {
                    type: "button",
                    ...dataAttributes({
                        // FlexLayout's path for a tabset's pop out button
                        "layout-path": `${engine.get("layout-path-by", { nodeId: container.value.id })}/button/popout`,
                        mode: state.mode,
                        target,
                    }),
                    onClick,
                },
                children: () => slots.default?.({ state }),
            });
        };
    },
);
