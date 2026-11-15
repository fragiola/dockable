import type { AnyTypes, DockableTypes, TabOf } from "@fragiola/dockable";
import { useTabOverflow } from "./composables";
import { useDockableContext, useLayoutContext } from "./context";
import { useTabContainer } from "./TabSet";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import { registerElement } from "./utils/registration";
import {
    dataAttributes,
    elementRef,
    type RenderSlot,
    renderElement,
} from "./utils/render";

export interface TabOverflowTriggerState<T extends DockableTypes = AnyTypes> {
    /** the tabs that do not fit in the strip, in model order: what the menu lists */
    hiddenTabs: TabOf<T>[];
}

export type TabOverflowTriggerProps = PrimitiveProps;

export interface TabOverflowTriggerSlots<T extends DockableTypes = AnyTypes>
    extends RenderSlot<TabOverflowTriggerState<T>> {
    /** the trigger's content (an icon, a count); the primitive renders no text of its own */
    default?: SlotFunction<{ state: TabOverflowTriggerState<T> }>;
}

/**
 * The button that opens the consumer's menu of hidden tabs, inside `Dockable.TabSet` or
 * `Dockable.Border`, next to the `Dockable.TabList`. It renders only while tabs are hidden, and the
 * engine reserves the space it takes in the strip. It renders no menu: make it your menu's trigger
 * (`as` or the `render` slot), list `useTabOverflow(node).hiddenTabs` (or the state's
 * `hiddenTabs`), and select with `tab.select`, which brings the tab into the strip. It has no name
 * of its own: give it an `aria-label`.
 */
export const TabOverflowTrigger: DockableComponent<
    TabOverflowTriggerProps,
    TabOverflowTriggerSlots
> = definePrimitive<TabOverflowTriggerProps, TabOverflowTriggerSlots>(
    "TabOverflowTrigger",
    ["as"],
    (props, { attrs, slots }) => {
        const container = useTabContainer("TabOverflowTrigger");
        const { revision } = useDockableContext("TabOverflowTrigger");
        const { engine } = useLayoutContext("TabOverflowTrigger");
        const { hiddenTabs } = useTabOverflow(container);
        const ref = elementRef(
            (element) => {
                const id = container.value.id;
                return registerElement(
                    engine,
                    `overflowtrigger:${id}`,
                    element,
                    (registered) =>
                        engine.adapter.registerOverflowTrigger(id, registered),
                );
            },
            () => [container.value.id],
        );
        return () => {
            revision.value;
            const hidden = hiddenTabs.value;
            if (hidden.length === 0) {
                return null;
            }
            const state: TabOverflowTriggerState = { hiddenTabs: hidden };
            return renderElement({
                tag: "button",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                ref,
                props: {
                    type: "button",
                    ...dataAttributes({
                        // FlexLayout's path for a tabset's overflow button
                        "layout-path": `${engine.get("layout-path-by", { nodeId: container.value.id })}/button/overflow`,
                        count: hidden.length,
                    }),
                },
                children: () => slots.default?.({ state }),
            });
        };
    },
);
