// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    type AnyTypes,
    type BorderLocation,
    type BorderNode,
    type DockableTypes,
    OVERLAY_ATTRIBUTE,
} from "@fragiola/dockable";
import * as React from "react";
import { borderAttributes } from "./Border";
import { useDockableContext, useLayoutContext } from "./context";
import { useBorder } from "./hooks";
import { Splitter } from "./Splitter";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

/** What a border shows: `Dockable.BorderContent`'s state (`Dockable.Border` adds its tab direction). */
export interface BorderContentState {
    /** the side of the layout the border is on */
    location: BorderLocation;
    /** the direction its tabs run: `"vertical"` for a left or right border */
    orientation: "horizontal" | "vertical";
    /** a tab is selected, so the border's panel is open */
    open: boolean;
    /** the panel opens over the layout (`mode: "overlay"`) instead of beside it */
    overlay: boolean;
    /** the border has no tabs */
    empty: boolean;
    /** the current drag would drop into this border (its strip or its open panel) */
    dropTarget: boolean;
    /** the current drag is over this border, but a drop rule refuses it */
    dropRefused: boolean;
}

export interface BorderContentProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<BorderContentState> {
    node: BorderNode<T>;
    /** renders the border's splitter (defaults to `<Dockable.Splitter node={border} />`) */
    renderSplitter?: ((border: BorderNode<T>) => React.ReactNode) | undefined;
    /** `false` renders no splitter (the panel keeps its size) */
    splitter?: boolean | undefined;
}

/**
 * The place a border's panel opens: an area sized by the border's `size` (the engine positions the
 * selected tab's panel over it) and the border's splitter, on the layout's side of it. Hidden while
 * no tab is selected. A docked border sits beside the layout and shrinks it; an overlay border
 * (`mode: "overlay"`) is positioned over the layout's edge, so its stacking (`z-index`) is yours.
 * Render it from `Dockable.Borders`'s `renderContent`.
 */
export function BorderContent<T extends DockableTypes = AnyTypes>(
    props: BorderContentProps<T>,
) {
    const { node, renderSplitter, splitter = true, ...rest } = props;
    const { model } = useDockableContext("BorderContent");
    const { engine } = useLayoutContext("BorderContent");
    const { state } = useBorder(node);
    const id = node.id;
    const areaRef = React.useCallback(
        (element: HTMLElement | null) => {
            engine.adapter.registerMeasurable(id, "bordercontent", element);
        },
        [engine, id],
    );
    const location = node.location;
    // a left or right border: sized by width
    const horizontal = location === "left" || location === "right";
    const { size, minSize, maxSize } =
        model.get("border-settings-by", { borderId: id }) ?? {};
    const path = engine.get("layout-path-by", { nodeId: id });
    const area = (
        <div
            key="area"
            ref={areaRef}
            {...dataAttributes({ "layout-path": `${path}/area` })}
            style={
                horizontal
                    ? { width: size, minWidth: minSize, maxWidth: maxSize }
                    : { height: size, minHeight: minSize, maxHeight: maxSize }
            }
        />
    );
    const splitterElement =
        splitter && state.open ? (
            <React.Fragment key="splitter">
                {renderSplitter ? (
                    renderSplitter(node)
                ) : (
                    <Splitter node={node} />
                )}
            </React.Fragment>
        ) : null;
    // the splitter is on the layout's side: after the area on the left and top
    const areaFirst = location === "left" || location === "top";

    const structural: React.CSSProperties = {
        display: state.open ? "flex" : "none",
        flexDirection: horizontal ? "row" : "column",
        flexShrink: 0,
    };
    if (state.overlay) {
        // hit-testing, not cosmetics: the overlay paints over the layout (its z-index is yours),
        // but presses must reach the tab panel under its empty area; its splitter takes them back
        Object.assign(
            structural,
            { position: "absolute" },
            engine.get("overlay-placement-by", { borderId: id }),
            { pointerEvents: "none" },
        );
    }
    return useRenderElement("div", rest, {
        state,
        props: {
            ...dataAttributes({
                "layout-path": `${path}/content`,
                ...borderAttributes(state),
            }),
            // a press inside an open overlay (its splitter included) does not close it
            ...(state.overlay ? { [OVERLAY_ATTRIBUTE]: "" } : {}),
            children: areaFirst
                ? [area, splitterElement]
                : [splitterElement, area],
        },
        style: structural,
    });
}
