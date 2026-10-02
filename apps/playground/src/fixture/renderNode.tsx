import {
    Dockable,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-react";
import type { ReactNode } from "react";
import type { Types } from "./layouts";
import { TabContent } from "./TabContent";

/** The unstyled composition shared by the fixtures: the developer owns the recursion. */
export function renderNode(
    child: TabsetNode<Types> | RowNode<Types>,
): ReactNode {
    if (child.type === "tabset") {
        return (
            <Dockable.TabSet node={child}>
                <Dockable.TabList<Types>
                    aria-label={child.data?.name ?? "Tabs"}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab}>{tab.label}</Dockable.Tab>
                    )}
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
}

export function renderPanel(tab: TabOf<Types>): ReactNode {
    return (
        <Dockable.Panel node={tab}>
            <TabContent tab={tab} />
        </Dockable.Panel>
    );
}
