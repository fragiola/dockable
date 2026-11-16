// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx (separator ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type BorderNode,
    type DockableTypes,
    getSplitterPath,
    type RowNode,
} from "@fragiola/dockable";
import { type SplitterState, useSplitter } from "../composables/use-splitter";
import { useDockableContext, useLayoutContext } from "../context";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    dataAttributes,
    type RenderSlot,
    renderElement,
} from "../utils/render";

export type { SplitterState };

export interface SplitterProps<T extends DockableTypes = AnyTypes>
    extends PrimitiveProps {
    /** the row (or border) the splitter resizes */
    node: RowNode<T> | BorderNode<T>;
    /** in a row, the splitter sits before child `index` (1-based); a border's splitter has none */
    index?: number | undefined;
}

export interface SplitterSlots extends RenderSlot<SplitterState> {
    /** the splitter's content (a grip); the primitive renders none */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * A splitter between two children of a row, or between a border's panel and the layout
 * (`role="separator"`). Drag it with the pointer, or focus it and use the arrow keys. While an
 * outline (non-realtime) drag is in progress it carries `data-dragging` and a structural
 * `transform` previewing where it will land. It has no name of its own: give it an `aria-label`
 * (through the `#splitter` slot where a `Row` or a border inserts it).
 */
export const Splitter: DockableComponent<SplitterProps, SplitterSlots> =
    definePrimitive<SplitterProps, SplitterSlots>(
        "Splitter",
        ["node", "index", "as"],
        (props, { attrs, slots }) => {
            const { revision } = useDockableContext("Splitter");
            const { engine } = useLayoutContext("Splitter");
            const { state, props: separator } = useSplitter(
                () => props.node,
                () => props.index,
            );
            return () => {
                revision.value;
                const current = state.value;
                const { ref, style, ...separatorProps } = separator.value;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: current,
                    ref,
                    props: {
                        ...separatorProps,
                        ...dataAttributes({
                            "layout-path": getSplitterPath(
                                engine.get("layout-path-by", {
                                    nodeId: props.node.id,
                                }),
                                props.index ?? 0,
                            ),
                            orientation: current.orientation,
                            dragging: current.dragging,
                        }),
                    },
                    style,
                    children: slots.default
                        ? () => slots.default?.({})
                        : undefined,
                });
            };
        },
    );
