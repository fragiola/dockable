// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Row.tsx (flex sizing from weights, splitters between children);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    AnyTypes,
    DockableTypes,
    RowNode,
    TabsetNode,
} from "@fragiola/dockable";
import * as React from "react";
import { typedModel, useDockableContext, useLayoutContext } from "./context";
import { useMeasurable } from "./hooks";
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
    /** a tabset of the layout is maximized outside this row, so the row is hidden */
    hidden: boolean;
}

export interface RowSplitterProps<T extends DockableTypes = AnyTypes> {
    /** the row the splitter resizes */
    node: RowNode<T>;
    /** the splitter sits before child `index` (1-based) */
    index: number;
}

export interface RowProps<T extends DockableTypes = AnyTypes>
    extends DivPrimitiveProps<RowState> {
    /**
     * the row to render; defaults to the root row of the enclosing layout (then pass the model's
     * registry as the type argument: `<Dockable.Row<Types>>`)
     */
    node?: RowNode<T> | undefined;
    /** renders a child: a tabset or a nested row */
    children: (child: TabsetNode<T> | RowNode<T>) => React.ReactNode;
    /** renders the splitter between two children (defaults to `<Dockable.Splitter />`) */
    renderSplitter?:
        | ((props: RowSplitterProps<T>) => React.ReactNode)
        | undefined;
    /** `false` renders no splitters */
    splitter?: boolean | undefined;
}

/**
 * A row (or column) of the layout. Lays its children out with flex, sized by their weights,
 * calls the child function per child and inserts a splitter between children.
 */
export function Row<T extends DockableTypes = AnyTypes>(props: RowProps<T>) {
    const { node, children, renderSplitter, splitter = true, ...rest } = props;
    const { model } = useDockableContext("Row");
    const { engine, layoutId } = useLayoutContext("Row");
    const row = node ?? typedModel<T>(model).get("root-row", { layoutId });
    if (!row) {
        throw new Error(`Dockable.Row: layout "${layoutId}" has no root row`);
    }
    const id = row.id;
    const root = node === undefined;
    const horizontal = engine.adapter.rowOrientation(id) === "horizontal";

    const ref = useMeasurable(engine, id, "row");

    const items: React.ReactNode[] = [];
    for (const [index, child] of row.children.entries()) {
        if (index > 0 && splitter) {
            items.push(
                <React.Fragment key={`splitter:${child.id}`}>
                    {renderSplitter ? (
                        renderSplitter({ node: row, index })
                    ) : (
                        <Splitter node={row} index={index} />
                    )}
                </React.Fragment>,
            );
        }
        items.push(
            <React.Fragment key={child.id}>{children(child)}</React.Fragment>,
        );
    }

    const state: RowState = {
        orientation: horizontal ? "horizontal" : "vertical",
        root,
        // a maximized tabset fills the layout: the rows off its path give up their space
        hidden: model.is("node-hidden-by-maximize", { nodeId: id }),
    };
    const flex = engine.get("flex-by", { nodeId: id });
    const structural: React.CSSProperties = {
        display: state.hidden ? "none" : "flex",
        flexDirection: horizontal ? "row" : "column",
        flexBasis: 0,
        flexGrow: flex.grow,
        minWidth: flex.minWidth,
        minHeight: flex.minHeight,
        maxWidth: flex.maxWidth,
        maxHeight: flex.maxHeight,
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
                "layout-path": root
                    ? "/row"
                    : engine.get("layout-path-by", { nodeId: id }),
                orientation: state.orientation,
                root,
            }),
            children: items,
        },
        style: structural,
    });
}
