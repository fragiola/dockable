import { Model, TabNode } from "@fragiola/dockable";
import * as React from "react";
import { useDockableContext } from "./context";

export interface PanelsProps {
    /** renders a tab's panel (a `Dockable.Panel`) */
    children: (tab: TabNode) => React.ReactNode;
}

/**
 * The panel layer. Place it once, directly under `Dockable.Root`. It calls the child function for
 * every tab of every layout of the model whose content should render: the selected tab once its
 * content area has a size, a tab rendered before (content is kept alive), and every tab with
 * render-on-demand disabled. Tabs are iterated in stable id order, so the framework never
 * reorders DOM the engine has re-parented. Renders no element of its own.
 */
export function Panels(props: PanelsProps) {
    const { children } = props;
    const { model, layers } = useDockableContext("Panels");
    if (!layers.has(Model.MAIN_LAYOUT_ID)) {
        return null; // the root is not attached yet: nothing can host content
    }

    // every layout, including those whose panel layer is not mounted (yet): the content of a tab
    // moving to a window that is still opening must stay mounted
    const tabs: TabNode[] = [];
    for (const [layoutId] of model.getLayouts()) {
        model.visitLayoutNodes(layoutId, (node) => {
            if (!(node instanceof TabNode)) {
                return;
            }
            const rect = node.getTabContainer().getContentRect();
            const visible = node.isSelected() || !node.isEnableRenderOnDemand();
            if (
                node.isRendered() ||
                (visible && rect.width > 0 && rect.height > 0)
            ) {
                node.setRendered(true);
                tabs.push(node);
            }
        });
    }
    tabs.sort((a, b) =>
        a.getId() < b.getId() ? -1 : a.getId() > b.getId() ? 1 : 0,
    );

    return (
        <>
            {tabs.map((tab) => (
                <React.Fragment key={tab.getId()}>
                    {children(tab)}
                </React.Fragment>
            ))}
        </>
    );
}
