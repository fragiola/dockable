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

// A thin line with a framed handle on it: a pill with a border, a shadow and two grip lines,
// centred on the splitter. The splitter itself stays 8px thick (the engine measures the element,
// not its children), so the pill is wider than the bar and overflows it on both sides; the line is
// the bar's `::before`. Hover, `data-dragging` and keyboard focus restyle the pill, read from the
// splitter through `group-…/splitter:` classes.

type Types = {
    tabs: {
        chart: { name: string; kind: ChartKind };
        kpi: { name: string; seed: number };
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
                    { component: "kpi", data: { name: "Revenue", seed: 3 } },
                    { component: "kpi", data: { name: "Orders", seed: 9 } },
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
                                data: { name: "Traffic", kind: "area" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "chart",
                                data: { name: "Channels", kind: "bar" },
                            },
                            {
                                component: "chart",
                                data: { name: "Share", kind: "pie" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function SplitterFramedHandle() {
    // The model is the source of truth: create it once, the layout renders from it.
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                {/* The layout's rows and tabsets: the developer owns the recursion. */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <FramedSplitter {...props} />}
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
                                    seed={tab.data.name.length}
                                    title={tab.data.name}
                                />
                            ) : (
                                <KpiPanel
                                    label={tab.data.name}
                                    seed={tab.data.seed}
                                />
                            )}
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
                renderSplitter={(props) => <FramedSplitter {...props} />}
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
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * The bar between two children of a row: a 1px line with a framed handle in the middle.
 * `data-orientation` is the ARIA one: "vertical" is a bar between side-by-side panes.
 */
function FramedSplitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.handle}>
                <span className={styles.handleLine} />
                <span className={styles.handleLine} />
            </span>
        </Dockable.Splitter>
    );
}
