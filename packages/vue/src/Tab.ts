// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx (APG keyboard handling, roving tab stop, ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    getTabButtonPath,
    type TabOf,
} from "@fragiola/dockable";
import { computed, inject } from "vue";
import { useDragNode, useTabHidden } from "./composables";
import { TabListKey, useDockableContext, useLayoutContext } from "./context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import {
    dataAttributes,
    elementRef,
    type RenderSlot,
    renderElement,
} from "./utils/render";

export interface TabState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the tab is pinned */
    pinned: boolean;
    /** the tab is being dragged */
    dragging: boolean;
    /** the tab can be popped out into a window */
    poppable: boolean;
    /** the tab does not fit in its strip, so it is hidden (tab overflow) */
    overflowHidden: boolean;
}

export interface TabProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    node: TabOf<T>;
}

export interface TabSlots extends RenderSlot<TabState> {
    /** the tab button's content; the primitive renders no text of its own */
    default?: SlotFunction<{ state: TabState }>;
}

/**
 * A tab button (`role="tab"`), following the APG tabs pattern with manual activation: arrow keys
 * (along the tab list's orientation, mirrored in RTL), Home and End move focus; click, Enter or
 * Space selects. Enter or Space on the selected tab moves focus into its panel. Renders only its
 * default slot.
 */
export const Tab: DockableComponent<TabProps, TabSlots> = definePrimitive<
    TabProps,
    TabSlots
>("Tab", ["node", "as"], (props, { attrs, slots }) => {
    const { model, revision, keyMap } = useDockableContext("Tab");
    const { engine } = useLayoutContext("Tab");
    const list = inject(TabListKey, null);
    const orientation = computed(() => list?.value ?? "horizontal");
    const id = () => props.node.id;
    const drag = useDragNode<AnyTypes>(() => props.node);
    const containerId = computed(() => {
        revision.value;
        return model.get("node-parent-by", { nodeId: id() })?.id ?? "";
    });
    const overflowHidden = useTabHidden(() => containerId.value, id);

    const ref = elementRef(
        (element) => {
            const tabId = id();
            const dragRef = drag.props.value.ref;
            dragRef(element); // the tab itself is the drag image
            engine.adapter.registerMeasurable(tabId, "tabbutton", element);
            return () => {
                dragRef(null);
                engine.adapter.registerMeasurable(tabId, "tabbutton", null);
            };
        },
        () => [id()],
    );
    // the core's rules: a press selects (or closes a border's open panel), the APG tab keys and
    // the key map's tab keys
    const onClick = () => {
        engine.adapter.handleTabClick(id());
    };
    const onKeydown = (event: KeyboardEvent) => {
        const element = event.currentTarget as HTMLElement | null;
        if (element) {
            engine.adapter.handleTabKeyDown(id(), event, {
                element,
                orientation: orientation.value,
            });
        }
    };

    return () => {
        revision.value;
        keyMap.value;
        const tabId = id();
        const selected = model.is("tab-selected", { tabId });
        const { ref: _dragRef, ...dragProps } = drag.props.value;
        const state: TabState = {
            selected,
            pinned: props.node.pinned === true,
            dragging: drag.state.value.dragging,
            // supported, and the model accepts `tab.popout` for it now
            poppable: engine.can("popout", { nodeId: tabId }),
            overflowHidden: overflowHidden.value,
        };
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state,
            ref,
            props: {
                id: engine.get("tab-button-dom-id-by", { tabId }),
                role: "tab",
                "aria-selected": selected,
                "aria-controls": engine.get("tab-panel-dom-id-by", { tabId }),
                "aria-keyshortcuts": engine.adapter.getKeyShortcuts(
                    "tab",
                    tabId,
                ),
                tabindex: engine.is("tab-tabbable", { tabId }) ? 0 : -1,
                ...dataAttributes({
                    "layout-path": getTabButtonPath(
                        engine.get("layout-path-by", { nodeId: tabId }),
                    ),
                    selected,
                    pinned: state.pinned,
                    dragging: state.dragging,
                    poppable: state.poppable,
                    "overflow-hidden": state.overflowHidden,
                }),
                ...dragProps,
                onClick,
                onKeydown,
            },
            // a tab that does not fit is taken out of the strip (tab overflow)
            style: state.overflowHidden ? { display: "none" } : undefined,
            children: () => slots.default?.({ state }),
        });
    };
});
