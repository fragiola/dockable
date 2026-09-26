// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/BorderTabSet.tsx,
// src/view/BorderTab.tsx and src/view/layout/BorderContainer.tsx (which borders show, the frame's
// nesting, the content area's size, split and overlay placement); the markup and class names are
// not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    type BorderNode,
    DockLocation,
    OVERLAY_ATTRIBUTE,
} from "@fragiola/dockable";
import * as React from "react";
import { type BorderState, borderAttributes } from "./Border";
import { useLayoutContext } from "./context";
import { useBorder } from "./hooks";
import { Splitter } from "./Splitter";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface BorderContentProps extends DivPrimitiveProps<BorderState> {
    node: BorderNode;
    /** renders the border's splitter (defaults to `<Dockable.Splitter node={border} />`) */
    renderSplitter?: ((border: BorderNode) => React.ReactNode) | undefined;
    /** `false` renders no splitter (the panel keeps its size) */
    splitter?: boolean | undefined;
}

/**
 * The place a border's panel opens: an area sized by the border's `size` (the engine positions the
 * selected tab's panel over it) and the border's splitter, on the layout's side of it. Hidden while
 * no tab is selected. A split border sits beside the layout and shrinks it; an overlay border
 * (`borderType: "overlay"`) is positioned over the layout's edge, so its stacking (`z-index`) is
 * yours. Render it from `Dockable.Borders`'s `renderContent`.
 */
export function BorderContent(props: BorderContentProps) {
    const { node, renderSplitter, splitter = true, ...rest } = props;
    const { engine } = useLayoutContext("BorderContent");
    const { state } = useBorder(node);
    const areaRef = React.useCallback(
        (element: HTMLElement | null) => {
            engine.registerMeasurable(node, "bordercontent", element);
        },
        [engine, node],
    );
    const horizontal = node.isHorizontal(); // a left or right border: sized by width
    const location = node.getLocation();
    const size = node.getSize();
    const area = (
        <div
            key="area"
            ref={areaRef}
            {...dataAttributes({ "layout-path": `${node.getPath()}/area` })}
            style={
                horizontal
                    ? {
                          width: size,
                          minWidth: node.getMinSize(),
                          maxWidth: node.getMaxSize(),
                      }
                    : {
                          height: size,
                          minHeight: node.getMinSize(),
                          maxHeight: node.getMaxSize(),
                      }
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
    const areaFirst =
        location === DockLocation.LEFT || location === DockLocation.TOP;

    const structural: React.CSSProperties = {
        display: state.open ? "flex" : "none",
        flexDirection: horizontal ? "row" : "column",
        flexShrink: 0,
    };
    if (state.overlay) {
        // hit-testing, not cosmetics: the overlay paints over the layout (its z-index is yours),
        // but presses must reach the tab panel under its empty area; its splitter takes them back
        Object.assign(structural, overlayPosition(node), {
            pointerEvents: "none",
        });
    }
    return useRenderElement("div", rest, {
        state,
        props: {
            ...dataAttributes({
                "layout-path": `${node.getPath()}/content`,
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

/**
 * An overlay's structural placement over the layout's edge. A left or right overlay stops at the
 * open top and bottom overlays, as FlexLayout's does.
 */
function overlayPosition(node: BorderNode): React.CSSProperties {
    const location = node.getLocation();
    const style: React.CSSProperties = { position: "absolute" };
    if (location === DockLocation.TOP || location === DockLocation.BOTTOM) {
        style.left = 0;
        style.right = 0;
        style[location === DockLocation.TOP ? "top" : "bottom"] = 0;
        return style;
    }
    style[location === DockLocation.LEFT ? "left" : "right"] = 0;
    style.top = 0;
    style.bottom = 0;
    const model = node.getModel();
    for (const other of model.getBorderSet().getBorders()) {
        if (
            other !== node &&
            other.isOverlay() &&
            other.isShowing() &&
            other.getSelected() !== -1
        ) {
            const inset = other.getSize() + model.getSplitterSize();
            if (other.getLocation() === DockLocation.TOP) {
                style.top = inset;
            } else if (other.getLocation() === DockLocation.BOTTOM) {
                style.bottom = inset;
            }
        }
    }
    return style;
}
