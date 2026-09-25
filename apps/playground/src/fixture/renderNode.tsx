import type { RowNode, TabNode, TabSetNode } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import type { ReactNode } from "react";
import { TabContent } from "./TabContent";

/** The unstyled composition shared by the fixtures: the developer owns the recursion. */
export function renderNode(child: TabSetNode | RowNode): ReactNode {
    if (child.getType() === "tabset") {
        const tabset = child as TabSetNode;
        return (
            <Dockable.TabSet node={tabset}>
                <Dockable.TabList aria-label={tabset.getName() ?? "Tabs"}>
                    {(tab) => (
                        <Dockable.Tab node={tab}>{tab.getName()}</Dockable.Tab>
                    )}
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child as RowNode}>{renderNode}</Dockable.Row>;
}

export function renderPanel(tab: TabNode): ReactNode {
    return (
        <Dockable.Panel node={tab}>
            <TabContent tab={tab} />
        </Dockable.Panel>
    );
}
