// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx (separator ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type BorderNode,
    DockableLabel,
    getSplitterPath,
    type ISplitterState,
    type RowNode,
} from "@fragiola/dockable";
import type * as React from "react";
import { useDockableContext } from "./context";
import { useSplitter } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface SplitterState extends ISplitterState {
    /** `"vertical"` for a splitter between side by side children, as its `aria-orientation` */
    orientation: "horizontal" | "vertical";
}

export interface SplitterProps extends DivPrimitiveProps<SplitterState> {
    /** the row (or border) the splitter resizes */
    node: RowNode | BorderNode;
    /** in a row, the splitter sits before child `index` (1-based); a border's splitter has none */
    index?: number | undefined;
    children?: React.ReactNode;
}

/**
 * A splitter between two children of a row, or between a border's panel and the layout
 * (`role="separator"`). Drag it with the pointer, or focus it and use the arrow keys. While an outline (non-realtime) drag is in progress it carries
 * `data-dragging` and a structural `transform` previewing where it will land.
 */
export function Splitter(props: SplitterProps) {
    const { node, index = 0, children, ...rest } = props;
    const { getLabel } = useDockableContext("Splitter");
    const { controller, state, aria, hidden, ref } = useSplitter(node, index);
    const horizontal = aria.orientation === "vertical";

    const structural: React.CSSProperties = {};
    if (hidden) {
        structural.display = "none";
    }
    if (state.previewOffset !== undefined) {
        structural.transform = horizontal
            ? `translateX(${state.previewOffset}px)`
            : `translateY(${state.previewOffset}px)`;
    }

    const splitterState: SplitterState = {
        ...state,
        orientation: aria.orientation,
    };
    return useRenderElement("div", rest, {
        state: splitterState,
        ref,
        props: {
            role: "separator",
            "aria-orientation": aria.orientation,
            "aria-valuenow": aria.valueNow,
            "aria-valuemin": aria.valueMin,
            "aria-valuemax": aria.valueMax,
            "aria-valuetext": aria.valueText,
            "aria-label": getLabel?.(DockableLabel.Splitter),
            tabIndex: 0,
            ...dataAttributes({
                "layout-path": getSplitterPath(node, index),
                orientation: aria.orientation,
                dragging: state.dragging,
            }),
            onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
                controller.onPointerDown(event.nativeEvent),
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                controller.onKeyDown(event.nativeEvent);
                if (event.nativeEvent.defaultPrevented) {
                    event.preventDefault();
                }
            },
            children,
        },
        style: structural,
    });
}
