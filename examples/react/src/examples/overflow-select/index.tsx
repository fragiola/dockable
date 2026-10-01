"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Select } from "#/components/ui/select";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// Only the tabs that do not fit leave the strip: the engine measures the tab list and hides them
// (tab overflow), keeping the selected tab in view, and Dockable.TabOverflowTrigger (rendered only
// while tabs are hidden) is the trigger of a Fragiola Select listing just those. Picking one
// selects it, which brings it into the strip; another tab goes to the select in its place.

// What the layout holds: file tabs, named in their data. `altName` names a tab in the select when
// it has no name of its own (an icon-only tab).
type Types = { tabs: { file: { name: string; altName?: string } } };

const file = (name: string): TabJson<Types> => ({
    component: "file",
    data: { name },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 65,
                children: [
                    file("main.ts"),
                    file("App.tsx"),
                    file("layout.tsx"),
                    file("styles.css"),
                    file("api.ts"),
                    file("README.md"),
                ],
            },
            {
                type: "tabset",
                weight: 35,
                children: [file("Terminal"), file("Problems")],
            },
        ],
    },
};

export default function OverflowSelect() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter around
        // the layout goes on a wrapper: padding on the root would not move the row.
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                {/* The layout's rows and tabsets: the developer owns the recursion. */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                {/* Every tab's content, positioned by the engine over its tabset. */}
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Card name={tab.data.name} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Where a dragged tab would land, animated at the layout's drag speed. */}
                <Dockable.DropIndicator
                    className={styles.dropIndicator}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
            </Dockable.Root>
        </div>
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset whose strip ends with the overflow select: the tabs that do not fit, listed. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const { hiddenTabs } = useTabOverflow(node);
    // a tab with no name (an icon-only tab) is named by its altName in the menu
    const label = (tab: TabOf<Types>) => tab.data.name || tab.data.altName;

    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>
                                {tab.data.name}
                            </span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <Select.Root
                    value={null}
                    onValueChange={(id) => {
                        if (typeof id === "string") {
                            model.run("tab.select", { tabId: id });
                        }
                    }}
                >
                    {/* the package's trigger (measured, shown only while tabs are hidden),
                        rendered as the Select's trigger */}
                    <Dockable.TabOverflowTrigger
                        aria-label={`${hiddenTabs.length} more tabs`}
                        render={
                            <Select.Trigger
                                className={styles.overflowTrigger}
                            />
                        }
                    >
                        {`+${hiddenTabs.length}`}
                    </Dockable.TabOverflowTrigger>
                    <Select.Content>
                        {hiddenTabs.map((tab) => (
                            <Select.Item key={tab.id} value={tab.id}>
                                {label(tab)}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row, with a grip for the themes that show one. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
