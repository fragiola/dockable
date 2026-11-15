// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type {
    AnyTypes,
    BorderLocation,
    BorderNode,
    DockableTypes,
} from "@fragiola/dockable";
import { type CSSProperties, Fragment, h } from "vue";
import { BorderContent } from "./BorderContent";
import { useIndicator } from "./composables";
import { useDockableContext, useLayoutContext } from "./context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import { dataAttributes, type RenderSlot, renderElement } from "./utils/render";

export interface BordersState {
    /** the layout has at least one border showing */
    borders: boolean;
}

export type BordersProps = PrimitiveProps;

export interface BordersSlots<T extends DockableTypes = AnyTypes>
    extends RenderSlot<BordersState> {
    /** the main layout: a `Dockable.Row` (its root row fills the area left by the borders) */
    default?: SlotFunction<Record<never, never>>;
    /** renders a border's strip: a `Dockable.Border` */
    bar?: SlotFunction<{ border: BorderNode<T> }>;
    /** renders a border's panel area (defaults to `<Dockable.BorderContent :node="border" />`) */
    content?: SlotFunction<{ border: BorderNode<T> }>;
}

const LOCATIONS: readonly BorderLocation[] = ["top", "bottom", "start", "end"];

/**
 * The frame that places the borders around the main layout, as FlexLayout does: the top and bottom
 * strips span the full width, the start and end strips sit between them, and each border's panel
 * area sits between its strip and the layout. Renders only structural flex. Place it directly in
 * `Dockable.Root` instead of the root `Dockable.Row`, with the row in its default slot.
 *
 * A border shows when its `show` is on and, if it `autoHide`s, when it has tabs or a drag reveals
 * it (near its edge of the layout).
 */
export const Borders: DockableComponent<BordersProps, BordersSlots> =
    definePrimitive<BordersProps, BordersSlots>(
        "Borders",
        ["as"],
        (props, { attrs, slots }) => {
            const { model: erased, revision } = useDockableContext("Borders");
            const model = erased;
            const { engine } = useLayoutContext("Borders");
            const shownIds = useIndicator(engine, () => {
                revision.value;
                return model
                    .get("borders")
                    .filter((border) =>
                        engine.is("border-shown", { borderId: border.id }),
                    )
                    .map((border) => border.id)
                    .join("\n");
            });
            return () => {
                revision.value;
                const borders = model.get("borders");
                const ids = shownIds.value.split("\n");
                const shown = new Map<BorderLocation, BorderNode>();
                for (const location of LOCATIONS) {
                    const border = borders.find((b) => b.location === location);
                    if (border && ids.includes(border.id)) {
                        shown.set(location, border);
                    }
                }
                const strip = (location: BorderLocation) => {
                    const border = shown.get(location);
                    return border
                        ? h(
                              Fragment,
                              { key: `bar:${border.id}` },
                              slots.bar?.({ border }),
                          )
                        : null;
                };
                const panel = (location: BorderLocation) => {
                    const border = shown.get(location);
                    return border
                        ? h(
                              Fragment,
                              { key: `content:${border.id}` },
                              slots.content
                                  ? slots.content({ border })
                                  : [h(BorderContent, { node: border })],
                          )
                        : null;
                };
                const fill: CSSProperties = {
                    display: "flex",
                    flexGrow: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    minHeight: 0,
                };
                const main = h(
                    "div",
                    {
                        ...dataAttributes({ "layout-path": "/main" }),
                        // the root row fills it (position: absolute; inset: 0)
                        style: { ...fill, position: "relative" },
                    },
                    slots.default?.({}),
                );
                const state: BordersState = { borders: shown.size > 0 };
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: dataAttributes({
                        "layout-path": "/borders",
                        borders: state.borders,
                    }),
                    // fills the layout root, as the root row does without borders
                    style: {
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                    },
                    children: () => [
                        strip("top"),
                        h(
                            "div",
                            {
                                key: "middle",
                                style: { ...fill, flexDirection: "row" },
                                ...dataAttributes({
                                    "layout-path": "/borders/middle",
                                }),
                            },
                            [
                                strip("start"),
                                // the anchor of top and bottom overlays
                                h(
                                    "div",
                                    {
                                        style: {
                                            ...fill,
                                            flexDirection: "column",
                                            position: "relative",
                                        },
                                        ...dataAttributes({
                                            "layout-path": "/borders/inner",
                                        }),
                                    },
                                    [
                                        panel("top"),
                                        // the anchor of start and end overlays
                                        h(
                                            "div",
                                            {
                                                style: {
                                                    ...fill,
                                                    flexDirection: "row",
                                                    position: "relative",
                                                },
                                                ...dataAttributes({
                                                    "layout-path":
                                                        "/borders/center",
                                                }),
                                            },
                                            [
                                                panel("start"),
                                                main,
                                                panel("end"),
                                            ],
                                        ),
                                        panel("bottom"),
                                    ],
                                ),
                                strip("end"),
                            ],
                        ),
                        strip("bottom"),
                    ],
                });
            };
        },
    );
