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
import * as React from "react";
import { BorderContent } from "./BorderContent";
import { typedModel, useDockableContext, useLayoutContext } from "./context";
import { useIndicator } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface BordersState {
    /** the layout has at least one border showing */
    borders: boolean;
}

export interface BordersProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<BordersState> {
    /** the main layout: a `Dockable.Row` (its root row fills the area left by the borders) */
    children?: React.ReactNode;
    /** renders a border's strip: a `Dockable.Border` */
    renderBar: (border: BorderNode<T>) => React.ReactNode;
    /** renders a border's panel area (defaults to `<Dockable.BorderContent node={border} />`) */
    renderContent?: ((border: BorderNode<T>) => React.ReactNode) | undefined;
}

const LOCATIONS: readonly BorderLocation[] = ["top", "bottom", "start", "end"];

/**
 * The frame that places the borders around the main layout, as FlexLayout does: the top and bottom
 * strips span the full width, the start and end strips sit between them, and each border's panel
 * area sits between its strip and the layout. Renders only structural flex. Place it directly in
 * `Dockable.Root` instead of the root `Dockable.Row`, and pass the row as its child.
 *
 * A border shows when its `show` is on and, if it `autoHide`s, when it has tabs or a drag reveals
 * it (near its edge of the layout). Pass the model's registry as the type argument
 * (`<Dockable.Borders<Types>>`) for typed borders in `renderBar` and `renderContent`.
 */
export function Borders<T extends DockableTypes = AnyTypes>(
    props: BordersProps<T>,
) {
    const { children, renderBar, renderContent, ...rest } = props;
    const { model: erased } = useDockableContext("Borders");
    const model = typedModel<T>(erased);
    const { engine } = useLayoutContext("Borders");
    const borders = model.get("borders");
    const shownIds = useIndicator(engine, () =>
        borders
            .filter((border) =>
                engine.is("border-shown", { borderId: border.id }),
            )
            .map((border) => border.id)
            .join("\n"),
    ).split("\n");

    const shown = new Map<BorderLocation, BorderNode<T>>();
    for (const location of LOCATIONS) {
        const border = borders.find((b) => b.location === location);
        if (border && shownIds.includes(border.id)) {
            shown.set(location, border);
        }
    }
    const strip = (location: BorderLocation) => {
        const border = shown.get(location);
        return border ? (
            <React.Fragment key={`bar:${border.id}`}>
                {renderBar(border)}
            </React.Fragment>
        ) : null;
    };
    const panel = (location: BorderLocation) => {
        const border = shown.get(location);
        return border ? (
            <React.Fragment key={`content:${border.id}`}>
                {renderContent ? (
                    renderContent(border)
                ) : (
                    <BorderContent node={border} />
                )}
            </React.Fragment>
        ) : null;
    };

    const fill: React.CSSProperties = {
        display: "flex",
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        minHeight: 0,
    };
    const main = (
        <div
            {...dataAttributes({ "layout-path": "/main" })}
            // the root row fills it (position: absolute; inset: 0)
            style={{ ...fill, position: "relative" }}
        >
            {children}
        </div>
    );
    const state: BordersState = { borders: shown.size > 0 };
    return useRenderElement("div", rest, {
        state,
        props: {
            ...dataAttributes({
                "layout-path": "/borders",
                borders: state.borders,
            }),
            children: [
                strip("top"),
                <div
                    key="middle"
                    style={{ ...fill, flexDirection: "row" }}
                    {...dataAttributes({ "layout-path": "/borders/middle" })}
                >
                    {strip("start")}
                    {/* the anchor of top and bottom overlays */}
                    <div
                        style={{
                            ...fill,
                            flexDirection: "column",
                            position: "relative",
                        }}
                        {...dataAttributes({
                            "layout-path": "/borders/inner",
                        })}
                    >
                        {panel("top")}
                        {/* the anchor of start and end overlays */}
                        <div
                            style={{
                                ...fill,
                                flexDirection: "row",
                                position: "relative",
                            }}
                            {...dataAttributes({
                                "layout-path": "/borders/center",
                            })}
                        >
                            {panel("start")}
                            {main}
                            {panel("end")}
                        </div>
                        {panel("bottom")}
                    </div>
                    {strip("end")}
                </div>,
                strip("bottom"),
            ],
        },
        // fills the layout root, as the root row does without borders
        style: {
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
        },
    });
}
