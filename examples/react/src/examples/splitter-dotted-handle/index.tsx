"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// A splitter with a handle drawn inside it: three dots, stacked along the bar. The splitter is
// `Dockable.Splitter` with children; the dots turn with it, read from the splitter's
// `data-orientation` by the `group-data-[orientation=…]/splitter:` classes, and they react to its
// hover and `data-dragging`. Nothing about the handle is the package's: it is markup and classes.

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
    };
};

// One column beside a row of two: the splitters run both ways.
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    { component: "kpi", label: "Revenue", data: { seed: 3 } },
                    { component: "kpi", label: "Orders", data: { seed: 9 } },
                ],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "chart",
                                label: "Traffic",
                                data: { kind: "area" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "chart",
                                label: "Channels",
                                data: { kind: "bar" },
                            },
                            {
                                component: "chart",
                                label: "Share",
                                data: { kind: "pie" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function SplitterDottedHandle() {
    // The model is the source of truth: create it once, the layout renders from it.
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                {/* The layout's rows and tabsets: the developer owns the recursion. */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <DottedSplitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                {/* Every tab's content, positioned by the engine over its tabset. */}
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            {tab.component === "chart" ? (
                                <ChartPanel
                                    kind={tab.data.kind}
                                    seed={tab.label.length}
                                    title={tab.label}
                                />
                            ) : (
                                <KpiPanel
                                    label={tab.label}
                                    seed={tab.data.seed}
                                />
                            )}
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
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
                renderSplitter={(props) => <DottedSplitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * The bar between two children of a row, 8px thick, with a grip of three dots in the middle.
 * `data-orientation` is the ARIA one: "vertical" is a bar between side-by-side panes.
 */
function DottedSplitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.grip}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
            </span>
        </Dockable.Splitter>
    );
}
