"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
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

export default function SplitterFramedHandle() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                <Dockable.Row<Types>
                    renderSplitter={(props) => <FramedSplitter {...props} />}
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
                <Dockable.DropIndicator className={styles.dropIndicator} />
            </Dockable.Root>
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.label.length}
                    title={tab.label}
                />
            );
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
    }
}

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
