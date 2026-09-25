import { Orientation, RowNode, type TabSetNode } from "@fragiola/dockable";
import * as React from "react";
import { useDockableContext, useLayoutContext } from "./context";
import { Splitter } from "./Splitter";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface RowState {
    orientation: "horizontal" | "vertical";
    /** the layout's root row */
    root: boolean;
}

export interface RowSplitterProps {
    /** the row the splitter resizes */
    node: RowNode;
    /** the splitter sits before child `index` (1-based) */
    index: number;
}

export interface RowProps extends DivPrimitiveProps<RowState> {
    /** the row to render; defaults to the root row of the enclosing layout */
    node?: RowNode | undefined;
    /** renders a child: a tabset or a nested row */
    children: (child: TabSetNode | RowNode) => React.ReactNode;
    /** renders the splitter between two children (defaults to `<Dockable.Splitter />`) */
    renderSplitter?: ((props: RowSplitterProps) => React.ReactNode) | undefined;
    /** `false` renders no splitters */
    splitter?: boolean | undefined;
}

/**
 * A row (or column) of the layout. Lays its children out with flex, sized by their weights,
 * calls the child function per child and inserts a splitter between children.
 */
export function Row(props: RowProps) {
    const { node, children, renderSplitter, splitter = true, ...rest } = props;
    useDockableContext("Row");
    const { engine, layoutId } = useLayoutContext("Row");
    const row = node ?? engine.getModel().getRootRow(layoutId);
    if (!(row instanceof RowNode)) {
        throw new Error(`Dockable.Row: layout "${layoutId}" has no root row`);
    }
    const root = node === undefined;
    const horizontal = row.getOrientation() === Orientation.HORZ;

    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.registerMeasurable(row, "row", element);
        },
        [engine, row],
    );

    const items: React.ReactNode[] = [];
    for (const [index, child] of row.getChildren().entries()) {
        const childNode = child as TabSetNode | RowNode;
        if (index > 0 && splitter) {
            items.push(
                <React.Fragment key={`splitter:${child.getId()}`}>
                    {renderSplitter ? (
                        renderSplitter({ node: row, index })
                    ) : (
                        <Splitter node={row} index={index} />
                    )}
                </React.Fragment>,
            );
        }
        items.push(
            <React.Fragment key={child.getId()}>
                {children(childNode)}
            </React.Fragment>,
        );
    }

    const state: RowState = {
        orientation: horizontal ? "horizontal" : "vertical",
        root,
    };
    const structural: React.CSSProperties = {
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        flexBasis: 0,
        // NOTE: flex-grow cannot have values < 1 otherwise it will not fill the parent
        flexGrow: Math.max(1, row.getWeight() * 1000),
        minWidth: row.getMinWidth(),
        minHeight: row.getMinHeight(),
        maxWidth: row.getMaxWidth(),
        maxHeight: row.getMaxHeight(),
        overflow: "hidden",
    };
    if (root) {
        // the root row fills the layout root
        Object.assign(structural, { position: "absolute", inset: 0 });
    }

    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            ...dataAttributes({
                "layout-path": root ? "/row" : row.getPath(),
                orientation: state.orientation,
                root,
            }),
            children: items,
        },
        style: structural,
    });
}
