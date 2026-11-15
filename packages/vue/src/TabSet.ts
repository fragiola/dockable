// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (sizing, activation on pointer down);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    AnyTypes,
    DockableTypes,
    TabContainer,
    TabsetNode,
} from "@fragiola/dockable";
import { type ComputedRef, computed, inject, provide } from "vue";
import { type TabSetState, useTabSet } from "./composables";
import {
    TabContainerKey,
    typedModel,
    useDockableContext,
    useLayoutContext,
} from "./context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import {
    dataAttributes,
    px,
    type RenderSlot,
    renderElement,
} from "./utils/render";

export type { TabSetState };

/** The enclosing tab container (a tabset or a border), of the registry the caller declares. */
function useContainerNode<T extends DockableTypes = AnyTypes>(part: string) {
    const id = inject(TabContainerKey, null);
    const { model, revision } = useDockableContext(part);
    return computed(() => {
        revision.value;
        return id === null
            ? undefined
            : typedModel<T>(model).get("node-by", { id: id.value });
    });
}

/** @internal the enclosing tabset or border, as a computed ref of its current node */
export function useTabContainer<T extends DockableTypes = AnyTypes>(
    part: string,
): ComputedRef<TabContainer<T>> {
    const node = useContainerNode<T>(part);
    const check = () => {
        const container = node.value;
        if (container?.type !== "tabset" && container?.type !== "border") {
            throw new Error(
                `Dockable.${part} must be rendered inside Dockable.TabSet or Dockable.Border`,
            );
        }
        return container;
    };
    check();
    return computed(check);
}

/** @internal the enclosing tabset, as a computed ref of its current node */
export function useTabSetNode(part: string): ComputedRef<TabsetNode> {
    const node = useContainerNode(part);
    const check = () => {
        const tabset = node.value;
        if (tabset?.type !== "tabset") {
            throw new Error(
                `Dockable.${part} must be rendered inside Dockable.TabSet`,
            );
        }
        return tabset;
    };
    check();
    return computed(check);
}

export interface TabSetProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    node: TabsetNode<T>;
}

export interface TabSetSlots extends RenderSlot<TabSetState> {
    /** the tabset's parts: a `Dockable.TabList`, a `Dockable.TabSetContent`, buttons */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * A tabset: a flex item of its row, sized by its weight. Pressing inside it makes it the active
 * tabset. Place a `Dockable.TabList` and a `Dockable.TabSetContent` inside.
 */
export const TabSet: DockableComponent<TabSetProps, TabSetSlots> =
    definePrimitive<TabSetProps, TabSetSlots>(
        "TabSet",
        ["node", "as"],
        (props, { attrs, slots }) => {
            const { revision } = useDockableContext("TabSet");
            const { engine } = useLayoutContext("TabSet");
            const { state, props: tabset } = useTabSet(() => props.node);
            provide(
                TabContainerKey,
                computed(() => props.node.id),
            );
            return () => {
                revision.value;
                const id = props.node.id;
                const current = state.value;
                const flex = engine.get("flex-by", { nodeId: id });
                const { ref, onPointerdown } = tabset.value;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: current,
                    ref,
                    props: {
                        ...dataAttributes({
                            "layout-path": engine.get("layout-path-by", {
                                nodeId: id,
                            }),
                            active: current.active,
                            maximized: current.maximized,
                            empty: current.empty,
                            "drop-target": current.dropTarget,
                            "drop-location": current.dropLocation,
                            "drop-refused": current.dropRefused,
                        }),
                        onPointerdown,
                    },
                    style: {
                        display: current.hidden ? "none" : "flex",
                        flexDirection: "column",
                        flexBasis: 0,
                        flexGrow: flex.grow,
                        minWidth: px(flex.minWidth),
                        minHeight: px(flex.minHeight),
                        maxWidth: px(flex.maxWidth),
                        maxHeight: px(flex.maxHeight),
                        overflow: "hidden",
                    },
                    children: () => slots.default?.({}),
                });
            };
        },
    );
