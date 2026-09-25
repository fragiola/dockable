import * as React from "react";
import { useLayoutContext } from "./context";
import { useTabSetNode } from "./TabSet";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface TabSetContentState {
    /** the tabset has no tabs */
    empty: boolean;
}

export type TabSetContentProps = DivPrimitiveProps<TabSetContentState>;

/**
 * Marks the tabset's content area: an empty element the engine measures, over which the selected
 * tab's panel is positioned. Nothing is rendered into it.
 */
export function TabSetContent(props: TabSetContentProps) {
    const tabset = useTabSetNode("TabSetContent");
    const { engine } = useLayoutContext("TabSetContent");
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.registerMeasurable(tabset, "tabsetcontent", element);
        },
        [engine, tabset],
    );
    const state: TabSetContentState = {
        empty: tabset.getChildren().length === 0,
    };
    return useRenderElement("div", props, {
        state,
        ref,
        props: dataAttributes({
            "layout-path": `${tabset.getPath()}/content`,
            empty: state.empty,
        }),
        style: { flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 },
    });
}
