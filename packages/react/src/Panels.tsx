// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx (renderTabContents: which tabs render);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    MAIN_LAYOUT,
    type TabOf,
} from "@fragiola/dockable";
import * as React from "react";
import { typedModel, useDockableContext } from "./context";

export interface PanelsProps<T extends DockableTypes = AnyTypes> {
    /** renders a tab's panel (a `Dockable.Panel`); `tab.data` narrows on `tab.component` */
    children: (tab: TabOf<T>) => React.ReactNode;
    /**
     * render a tab's content only once it is first shown (default `true`); `false` renders every
     * tab's content at once. A function decides per tab.
     */
    renderOnDemand?: boolean | ((tab: TabOf<T>) => boolean) | undefined;
}

/**
 * The panel layer. Place it once, directly under `Dockable.Root`, with the model's registry as its
 * type argument (`<Dockable.Panels<Types>>`). It calls the child function for every tab of every
 * layout of the model whose content should render: the selected tab once its content area has a
 * size, a tab rendered before (content is kept alive), and every tab not rendered on demand. Tabs
 * are iterated in stable id order, so the framework never reorders DOM the engine has re-parented.
 * Renders no element of its own.
 */
export function Panels<T extends DockableTypes = AnyTypes>(
    props: PanelsProps<T>,
) {
    const { children, renderOnDemand = true } = props;
    const { model: erased, engine, layers } = useDockableContext("Panels");
    if (!layers.has(MAIN_LAYOUT)) {
        return null; // the root is not attached yet: nothing can host content
    }
    const model = typedModel<T>(erased);

    // every layout, including those whose panel layer is not mounted (yet): the content of a tab
    // moving to a window that is still opening must stay mounted
    const all = [
        ...model.tabs(),
        ...model.state.windows.flatMap((window) => model.tabs(window.id)),
    ];
    const tabs = all.filter((tab) =>
        engine.shouldRender(
            tab.id,
            typeof renderOnDemand === "function"
                ? renderOnDemand(tab)
                : renderOnDemand,
        ),
    );
    tabs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    return (
        <>
            {tabs.map((tab) => (
                <React.Fragment key={tab.id}>{children(tab)}</React.Fragment>
            ))}
        </>
    );
}
