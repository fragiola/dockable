// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { AnyTypes, BorderNode, DockableTypes } from "@fragiola/dockable";
import { computed, provide } from "vue";
import { type BorderContentState, useBorder } from "./composables";
import {
    TabContainerKey,
    useDockableContext,
    useLayoutContext,
} from "./context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import { dataAttributes, type RenderSlot, renderElement } from "./utils/render";

export type { BorderContentState };

export interface BorderState extends BorderContentState {
    /** the start border's tab direction (the `tabDirection` prop): `"up"` (default) or `"down"` */
    tabDirection: "up" | "down" | undefined;
}

/** @internal the data attributes of a border's state, shared by its strip and its content */
export function borderAttributes(state: BorderContentState) {
    return {
        location: state.location,
        orientation: state.orientation,
        open: state.open,
        overlay: state.overlay,
        docked: !state.overlay,
        empty: state.empty,
    };
}

export interface BorderProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    node: BorderNode<T>;
    /**
     * the start border's tab direction, exposed as `data-tab-direction` for your styles (rotating the
     * labels is yours): `"up"` (default) or `"down"`
     */
    tabDirection?: "up" | "down" | undefined;
}

export interface BorderSlots extends RenderSlot<BorderState> {
    /** the strip's content: a `Dockable.TabList`, and any buttons */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * A border's strip: the bar on one side of the layout that holds its tabs. Place a
 * `Dockable.TabList` inside (it runs vertically in a start or end border). Clicking a tab opens
 * the border's panel; clicking the selected tab closes it. Render it from `Dockable.Borders`'s
 * `#bar` slot. Rotating the tab labels of a side border is styling, and yours.
 */
export const Border: DockableComponent<BorderProps, BorderSlots> =
    definePrimitive<BorderProps, BorderSlots>(
        "Border",
        ["node", "tabDirection", "as"],
        (props, { attrs, slots }) => {
            const { revision } = useDockableContext("Border");
            const { engine } = useLayoutContext("Border");
            const border = useBorder(() => props.node);
            provide(
                TabContainerKey,
                computed(() => props.node.id),
            );
            return () => {
                revision.value;
                const state: BorderState = {
                    ...border.state.value,
                    tabDirection:
                        props.node.location === "start"
                            ? (props.tabDirection ?? "up")
                            : undefined,
                };
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    ref: border.props.value.ref,
                    props: dataAttributes({
                        "layout-path": engine.get("layout-path-by", {
                            nodeId: props.node.id,
                        }),
                        ...borderAttributes(state),
                        "tab-direction": state.tabDirection,
                        "drop-target": state.dropTarget,
                        "drop-refused": state.dropRefused,
                    }),
                    style: {
                        display: "flex",
                        flexDirection:
                            state.orientation === "vertical" ? "column" : "row",
                    },
                    children: () => slots.default?.({}),
                });
            };
        },
    );
