import { useMeasurable } from "./composables";
import { useDockableContext, useLayoutContext } from "./context";
import { useTabSetNode } from "./TabSet";
import {
    type DockableComponent,
    definePrimitive,
    type PrimitiveProps,
} from "./utils/primitive";
import { dataAttributes, type RenderSlot, renderElement } from "./utils/render";

export interface TabSetContentState {
    /** the tabset has no tabs */
    empty: boolean;
}

export type TabSetContentProps = PrimitiveProps;

export type TabSetContentSlots = RenderSlot<TabSetContentState>;

/**
 * Marks the tabset's content area: an empty element the engine measures, over which the selected
 * tab's panel is positioned. Nothing is rendered into it.
 */
export const TabSetContent: DockableComponent<
    TabSetContentProps,
    TabSetContentSlots
> = definePrimitive<TabSetContentProps, TabSetContentSlots>(
    "TabSetContent",
    ["as"],
    (props, { attrs, slots }) => {
        const tabset = useTabSetNode("TabSetContent");
        const { revision } = useDockableContext("TabSetContent");
        const { engine } = useLayoutContext("TabSetContent");
        const ref = useMeasurable(
            engine,
            () => tabset.value.id,
            "tabsetcontent",
        );
        return () => {
            revision.value;
            const id = tabset.value.id;
            const state: TabSetContentState = {
                empty: tabset.value.children.length === 0,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                ref,
                props: dataAttributes({
                    "layout-path": `${engine.get("layout-path-by", { nodeId: id })}/content`,
                    empty: state.empty,
                }),
                style: {
                    flexGrow: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    minHeight: 0,
                },
            });
        };
    },
);
