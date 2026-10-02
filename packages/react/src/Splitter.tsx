// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx (separator ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type BorderNode,
    type DockableTypes,
    getSplitterPath,
    type RowNode,
    type SplitterControllerState,
} from "@fragiola/dockable";
import type * as React from "react";
import { useLayoutContext } from "./context";
import { useSplitter } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface SplitterState extends SplitterControllerState {
    /** `"vertical"` for a splitter between side by side children, as its `aria-orientation` */
    orientation: "horizontal" | "vertical";
    /** row splitters are hidden while a tabset is maximized */
    hidden: boolean;
}

export interface SplitterProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<SplitterState> {
    /** the row (or border) the splitter resizes */
    node: RowNode<T> | BorderNode<T>;
    /** in a row, the splitter sits before child `index` (1-based); a border's splitter has none */
    index?: number | undefined;
    children?: React.ReactNode;
}

/**
 * A splitter between two children of a row, or between a border's panel and the layout
 * (`role="separator"`). Drag it with the pointer, or focus it and use the arrow keys. While an outline (non-realtime) drag is in progress it carries
 * `data-dragging` and a structural `transform` previewing where it will land. It has no name of
 * its own: give it an `aria-label` (through `renderSplitter` where a `Row` or a border inserts it).
 */
export function Splitter<T extends DockableTypes = AnyTypes>(
    props: SplitterProps<T>,
) {
    const { node, index = 0, children, ...rest } = props;
    const { engine } = useLayoutContext("Splitter");
    const { state, props: separator } = useSplitter(node, index);
    const { ref, style, ...separatorProps } = separator;
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            ...separatorProps,
            ...dataAttributes({
                "layout-path": getSplitterPath(
                    engine.get("layout-path-by", { nodeId: node.id }),
                    index,
                ),
                orientation: state.orientation,
                dragging: state.dragging,
            }),
            children,
        },
        style,
    });
}
