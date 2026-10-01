"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useTabSet,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// No drop outline at all (the root has no `Dockable.DropIndicator`): the targets show themselves.
// While a drag would drop into (or beside) a tabset, it has `data-drop-target` and
// `data-drop-location` (center, top, bottom, left, right); a drop into its tab strip also gives the
// insertion index. The styles read only those.

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "card", data: { name: "Alpha" } },
                    { component: "card", data: { name: "Beta" } },
                    { component: "card", data: { name: "Gamma" } },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Delta" } },
                            { component: "card", data: { name: "Epsilon" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Zeta" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function DropTargetHighlight() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Card name={tab.data.name} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* no Dockable.DropIndicator: the highlights in TabSet replace the outline */}
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

/** A tabset that marks itself while it is a drop target: a ring or a side bar, and a caret in its strip. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    // the same state the tabset's data-* come from: is a strip drop aimed here, and where?
    const { dropIndex } = useTabSet(node).state;
    const tabs = node.children;
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => {
                        const index = tabs.findIndex((t) => t.id === tab.id);
                        const before = dropIndex === index;
                        const after =
                            dropIndex === tabs.length &&
                            index === tabs.length - 1;
                        return (
                            <Dockable.Tab
                                node={tab}
                                // a caret before (or after) the tab, at the strip's insertion point
                                className={styles.tab(before, after)}
                            >
                                <span className={styles.tabName}>
                                    {tab.data.name}
                                </span>
                                {/* the active tabset's marker */}
                                <span
                                    aria-hidden="true"
                                    className={styles.tabMarker}
                                />
                            </Dockable.Tab>
                        );
                    }}
                </Dockable.TabList>
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
