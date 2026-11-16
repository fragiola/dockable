// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    type AnyTypes,
    type BorderNode,
    type DockableTypes,
    OVERLAY_ATTRIBUTE,
} from "@fragiola/dockable";
import { type CSSProperties, Fragment, h } from "vue";
import { useMeasurable } from "../composables/internal";
import { type BorderContentState, useBorder } from "../composables/use-border";
import { useDockableContext, useLayoutContext } from "../context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    dataAttributes,
    px,
    type RenderSlot,
    renderElement,
} from "../utils/render";
import { borderAttributes } from "./border";
import { Splitter } from "./splitter";

export type { BorderContentState };

export interface BorderContentProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    node: BorderNode<T>;
    /** `false` renders no splitter (the panel keeps its size) */
    splitter?: boolean | undefined;
}

export interface BorderContentSlots<T extends DockableTypes = AnyTypes>
    extends RenderSlot<BorderContentState> {
    /**
     * renders the border's splitter (defaults to `<Dockable.Splitter v-bind="props" />`): `props`
     * is the splitter's `{ node }`
     */
    splitter?: SlotFunction<{ props: { node: BorderNode<T> } }>;
}

/**
 * The place a border's panel opens: an area sized by the border's `size` (the engine positions the
 * selected tab's panel over it) and the border's splitter, on the layout's side of it. Hidden while
 * no tab is selected. A docked border sits beside the layout and shrinks it; an overlay border
 * (`mode: "overlay"`) is positioned over the layout's edge, so its stacking (`z-index`) is yours.
 * Render it from `Dockable.Borders`'s `#content` slot.
 */
export const BorderContent: DockableComponent<
    BorderContentProps,
    BorderContentSlots
> = definePrimitive<BorderContentProps, BorderContentSlots>(
    "BorderContent",
    ["node", "splitter", "as"],
    (props, { attrs, slots }) => {
        const { model, revision } = useDockableContext("BorderContent");
        const { engine } = useLayoutContext("BorderContent");
        const { state } = useBorder(() => props.node);
        const areaRef = useMeasurable(
            engine,
            () => props.node.id,
            "bordercontent",
        );
        return () => {
            revision.value;
            const node = props.node;
            const id = node.id;
            const current = state.value;
            const location = node.location;
            // a start or end border: sized by width
            const horizontal = location === "start" || location === "end";
            const { size, minSize, maxSize } =
                model.get("border-settings-by", { borderId: id }) ?? {};
            const path = engine.get("layout-path-by", { nodeId: id });
            const area = h("div", {
                key: "area",
                ref: areaRef,
                ...dataAttributes({ "layout-path": `${path}/area` }),
                style: horizontal
                    ? {
                          width: px(size),
                          minWidth: px(minSize),
                          maxWidth: px(maxSize),
                      }
                    : {
                          height: px(size),
                          minHeight: px(minSize),
                          maxHeight: px(maxSize),
                      },
            });
            const splitterProps = { node };
            const splitter =
                props.splitter !== false && current.open
                    ? h(
                          Fragment,
                          { key: "splitter" },
                          slots.splitter
                              ? slots.splitter({ props: splitterProps })
                              : [h(Splitter, splitterProps)],
                      )
                    : null;
            // the splitter is on the layout's side: after the area on the start and top
            const areaFirst = location === "start" || location === "top";
            const structural: CSSProperties = {
                display: current.open ? "flex" : "none",
                flexDirection: horizontal ? "row" : "column",
                flexShrink: 0,
            };
            if (current.overlay) {
                // hit-testing, not cosmetics: the overlay paints over the layout (its z-index is
                // yours), but presses must reach the tab panel under its empty area; its splitter
                // takes them back
                const placement =
                    engine.get("overlay-placement-by", { borderId: id }) ?? {};
                Object.assign(
                    structural,
                    { position: "absolute" },
                    Object.fromEntries(
                        Object.entries(placement).map(([key, value]) => [
                            key,
                            px(value),
                        ]),
                    ),
                    { pointerEvents: "none" },
                );
            }
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state: current,
                props: {
                    ...dataAttributes({
                        "layout-path": `${path}/content`,
                        ...borderAttributes(current),
                    }),
                    // a press inside an open overlay (its splitter included) does not close it
                    ...(current.overlay ? { [OVERLAY_ATTRIBUTE]: "" } : {}),
                },
                style: structural,
                children: () =>
                    areaFirst ? [area, splitter] : [splitter, area],
            });
        };
    },
    ["splitter"],
);
