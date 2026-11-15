// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (the tab strip's ARIA and key shortcuts);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    getTabStripPath,
    type TabOf,
} from "@fragiola/dockable";
import { computed, Fragment, h, provide } from "vue";
import { useDropState, useTabOverflow } from "./composables";
import { TabListKey, useDockableContext, useLayoutContext } from "./context";
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

export interface TabListState {
    orientation: "horizontal" | "vertical";
    /** the current drag would drop into this tab strip */
    dropTarget: boolean;
    /** while it is the drop target: the insertion index in the strip */
    dropIndex: number | undefined;
    /** some tabs do not fit, so they are hidden (list them with `Dockable.TabOverflowTrigger`) */
    overflowing: boolean;
}

export interface TabListProps extends PrimitiveProps {
    /**
     * the direction the tabs are laid out in, for arrow key navigation; default horizontal
     * (vertical in a start or end border)
     */
    orientation?: "horizontal" | "vertical" | undefined;
    /**
     * tab overflow: the tabs that do not fit are hidden (the selected one stays), for a
     * `Dockable.TabOverflowTrigger` to list; `false` keeps every tab, for a strip that wraps or
     * scrolls. Default `true`
     */
    overflow?: boolean | undefined;
}

export interface TabListSlots<T extends DockableTypes = AnyTypes>
    extends RenderSlot<TabListState> {
    /**
     * renders a tab button (a `Dockable.Tab`); with `typedDockable<Types>().TabList`, `tab.data`
     * narrows on `tab.component`
     */
    default?: SlotFunction<{ tab: TabOf<T> }>;
}

/**
 * The tab strip (`role="tablist"`) of a tabset or a border. Renders the default slot per tab.
 * Arrow keys along the orientation (Left and Right swap in RTL, where a horizontal strip runs from
 * the right), Home and End move focus between tabs; Enter or Space selects.
 */
export const TabList: DockableComponent<TabListProps, TabListSlots> =
    definePrimitive<TabListProps, TabListSlots>(
        "TabList",
        ["orientation", "overflow", "as"],
        (props, { attrs, slots }) => {
            const container = useTabContainer("TabList");
            const { revision, keyMap } = useDockableContext("TabList");
            const { engine } = useLayoutContext("TabList");
            const orientation = computed(() => {
                const current = container.value;
                return (
                    props.orientation ??
                    (current.type === "border" &&
                    (current.location === "start" || current.location === "end")
                        ? "vertical"
                        : "horizontal")
                );
            });
            provide(TabListKey, orientation);
            const id = () => container.value.id;
            const border = () => container.value.type === "border";
            const overflow = () => props.overflow !== false;
            const ref = elementRef(
                (element) => {
                    const containerId = id();
                    const inBorder = border();
                    const vertical = orientation.value === "vertical";
                    // a border's strip is measured as a whole by Dockable.Border
                    const unregisterStrip = inBorder
                        ? undefined
                        : registerElement(
                              engine,
                              `tabstrip:${containerId}`,
                              element,
                              (registered) =>
                                  engine.adapter.registerMeasurable(
                                      containerId,
                                      "tabstrip",
                                      registered,
                                  ),
                          );
                    // the tabs that do not fit in the list are hidden (tab overflow)
                    const unregisterList = registerElement(
                        engine,
                        `tablist:${containerId}`,
                        element,
                        (registered) =>
                            engine.adapter.registerTabList(
                                containerId,
                                registered && overflow() ? registered : null,
                                vertical,
                            ),
                    );
                    return () => {
                        unregisterStrip?.();
                        unregisterList();
                    };
                },
                () => [id(), border(), orientation.value, overflow()],
            );
            const { overflowing } = useTabOverflow(container);
            const drop = useDropState(engine, id);
            return () => {
                revision.value;
                keyMap.value;
                const current = container.value;
                const state: TabListState = {
                    orientation: orientation.value,
                    dropTarget: drop.value.index !== undefined,
                    dropIndex: drop.value.index,
                    overflowing: overflowing.value,
                };
                const tabs = current.children.map((tab) =>
                    h(Fragment, { key: tab.id }, slots.default?.({ tab })),
                );
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    ref,
                    props: {
                        role: "tablist",
                        "aria-orientation": state.orientation,
                        "aria-keyshortcuts":
                            engine.adapter.getKeyShortcuts("tablist"),
                        ...dataAttributes({
                            "layout-path": getTabStripPath(
                                engine.get("layout-path-by", {
                                    nodeId: current.id,
                                }),
                            ),
                            orientation: state.orientation,
                            "drop-target": state.dropTarget,
                            "drop-index": state.dropIndex,
                            overflowing: state.overflowing,
                        }),
                    },
                    children: () => tabs,
                });
            };
        },
        ["overflow"],
    );
