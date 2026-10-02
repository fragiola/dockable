"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useTabSet,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// No drop outline at all (the root has no `Dockable.DropIndicator`): the targets show themselves.
// While a drag would drop into (or beside) a tabset, it has `data-drop-target` and
// `data-drop-location` (center, top, bottom, left, right); a drop into its tab strip also gives the
// insertion index. The styles read only those: a layer in the tabset, above its panel, fills the
// part the drop would take, and a caret marks the insertion point in the strip.

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
                            <Content tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* no Dockable.DropIndicator: the highlights in TabSet replace the outline */}
            </Dockable.Root>
        </div>
    );
}

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

/** A tab's content: `tab.data` and the component narrow together. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.data.seed}
                    title={tab.label}
                />
            );
        case "kpi":
            return (
                <KpiPanel
                    label={tab.label}
                    seed={tab.data.seed}
                    unit={tab.data.unit}
                />
            );
        case "table":
            return <TablePanel />;
    }
}

/** A tabset that marks itself while it is a drop target: the part the drop would take, or a caret in its strip. */
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
                            <Dockable.Tab node={tab} className={styles.tab}>
                                <span className={styles.tabName}>
                                    {tab.label}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={styles.tabMarker}
                                />
                                {/* the strip's insertion point, before (or after) this tab */}
                                {(before || after) && (
                                    <span
                                        aria-hidden="true"
                                        className={styles.dropCaret(after)}
                                    />
                                )}
                            </Dockable.Tab>
                        );
                    }}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
            <span aria-hidden="true" className={styles.dropHighlight} />
        </Dockable.TabSet>
    );
}

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
