// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Row.tsx (flex sizing from weights, splitters between children);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import type {
    AnyTypes,
    DockableTypes,
    RowNode,
    TabsetNode,
} from "@fragiola/dockable";
import { type CSSProperties, Fragment, h, type VNodeChild } from "vue";
import { useMeasurable } from "./composables";
import { useDockableContext, useLayoutContext } from "./context";
import { Splitter } from "./Splitter";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "./utils/primitive";
import {
    dataAttributes,
    px,
    type RenderSlot,
    renderElement,
} from "./utils/render";

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
    extends PrimitiveProps {
    /**
     * the row to render; defaults to the root row of the enclosing layout (then type the registry
     * with `typedDockable<Types>().Row`)
     */
    node?: RowNode<T> | undefined;
    /** `false` renders no splitters */
    splitter?: boolean | undefined;
}

export interface RowSlots<T extends DockableTypes = AnyTypes>
    extends RenderSlot<RowState> {
    /** renders a child: a tabset or a nested row */
    default?: SlotFunction<{ node: TabsetNode<T> | RowNode<T> }>;
    /**
     * renders the splitter between two children (defaults to `<Dockable.Splitter v-bind="props" />`):
     * `props` is the splitter's `{ node, index }`
     */
    splitter?: SlotFunction<{ props: RowSplitterProps<T> }>;
}

/**
 * A row (or column) of the layout. Lays its children out with flex, sized by their weights,
 * renders the default slot per child and inserts a splitter between children.
 */
export const Row: DockableComponent<RowProps, RowSlots> = definePrimitive<
    RowProps,
    RowSlots
>("Row", ["node", "splitter", "as"], (props, { attrs, slots }) => {
    const { model, revision } = useDockableContext("Row");
    const { engine, layoutId } = useLayoutContext("Row");
    const current = () => {
        const row = props.node ?? model.get("root-row", { layoutId });
        if (!row) {
            throw new Error(
                `Dockable.Row: layout "${layoutId}" has no root row`,
            );
        }
        return row;
    };
    const ref = useMeasurable(engine, () => current().id, "row");
    return () => {
        revision.value;
        const row = current();
        const id = row.id;
        const root = props.node === undefined;
        const horizontal = engine.adapter.rowOrientation(id) === "horizontal";
        const items: VNodeChild[] = [];
        for (const [index, child] of row.children.entries()) {
            if (index > 0 && props.splitter !== false) {
                const splitterProps: RowSplitterProps = { node: row, index };
                items.push(
                    h(
                        Fragment,
                        { key: `splitter:${child.id}` },
                        slots.splitter
                            ? slots.splitter({ props: splitterProps })
                            : [h(Splitter, splitterProps)],
                    ),
                );
            }
            items.push(
                h(
                    Fragment,
                    { key: child.id },
                    slots.default?.({ node: child }),
                ),
            );
        }
        const state: RowState = {
            orientation: horizontal ? "horizontal" : "vertical",
            root,
            // a maximized tabset fills the layout: the rows off its path give up their space
            hidden: model.is("node-hidden-by-maximize", { nodeId: id }),
        };
        const flex = engine.get("flex-by", { nodeId: id });
        const structural: CSSProperties = {
            display: state.hidden ? "none" : "flex",
            flexDirection: horizontal ? "row" : "column",
            flexBasis: 0,
            flexGrow: flex.grow,
            minWidth: px(flex.minWidth),
            minHeight: px(flex.minHeight),
            maxWidth: px(flex.maxWidth),
            maxHeight: px(flex.maxHeight),
            overflow: "hidden",
        };
        if (root) {
            // the root row fills the layout root
            Object.assign(structural, { position: "absolute", inset: 0 });
        }
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state,
            ref,
            props: dataAttributes({
                "layout-path": root
                    ? "/row"
                    : engine.get("layout-path-by", { nodeId: id }),
                orientation: state.orientation,
                root,
            }),
            style: structural,
            children: () => items,
        });
    };
});
