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
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// No drop outline at all (the root has no `Dockable.DropIndicator`): the targets show themselves.
// While a drag would drop into (or beside) a tabset, it has `data-drop-target` and
// `data-drop-location` (center, top, bottom, left, right); a drop into its tab strip also gives the
// insertion index. The styles read only those.

// What the layout holds: one component per kind of content, each named by its label.
type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number; unit?: string };
        table: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 40,
                children: [
                    {
                        component: "chart",
                        label: "Alpha",
                        data: { kind: "line", seed: 3 },
                    },
                    { component: "kpi", label: "Beta", data: { seed: 11 } },
                    {
                        component: "chart",
                        label: "Gamma",
                        data: { kind: "pie", seed: 17 },
                    },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Delta",
                                data: { kind: "bar", seed: 8 },
                            },
                            { component: "table", label: "Epsilon" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Zeta",
                                data: { seed: 25, unit: "$" },
                            },
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
                            {tab.component === "chart" ? (
                                <ChartPanel
                                    kind={tab.data.kind}
                                    seed={tab.data.seed}
                                    title={tab.label}
                                />
                            ) : tab.component === "kpi" ? (
                                <KpiPanel
                                    label={tab.label}
                                    seed={tab.data.seed}
                                    unit={tab.data.unit}
                                />
                            ) : (
                                <TablePanel />
                            )}
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
                                    {tab.label}
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
