"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type Model,
    type RowNode,
    type RowSplitterProps,
    type TabNode,
    type TabOf,
    type TabsetNode,
    useModelState,
} from "@fragiola/dockable-react";
import {
    ChartArea,
    ChartColumn,
    ChartLine,
    ChartPie,
    Donut,
    Shuffle,
} from "lucide-react";
import { useState } from "react";
import { type ChartKind, ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// A toolbar outside the layout acts on the tab the user is looking at: the selected tab of the
// active tabset. Click another tabset and the toolbar follows it. What it changes (the chart's
// kind, its data) is the tab's typed data, patched with `tab.set-data`: the chart re-renders from
// it, and it would be saved with the layout. A table tab has nothing to drive: the toolbar says so.

type ChartData = { kind: ChartKind; seed: number };

type Types = {
    tabs: {
        chart: ChartData;
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
                weight: 55,
                children: [
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar", seed: 3 },
                    },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "donut", seed: 5 },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line", seed: 9 },
                    },
                ],
            },
        ],
    },
};

const KINDS: { kind: ChartKind; label: string; Icon: typeof ChartLine }[] = [
    { kind: "line", label: "Line", Icon: ChartLine },
    { kind: "area", label: "Area", Icon: ChartArea },
    { kind: "bar", label: "Bar", Icon: ChartColumn },
    { kind: "pie", label: "Pie", Icon: ChartPie },
    { kind: "donut", label: "Donut", Icon: Donut },
];

/** The tab the user is looking at: the selected tab of the active tabset (else the first). */
function currentTab(model: Model<Types>) {
    const tabset = model.get("default-tabset");
    return tabset
        ? model.get("selected-tab-by", { tabsetId: tabset.id })
        : undefined;
}

/** Changes some keys of a chart tab's data (`tab.set-data` keeps the others). */
function updateChart(
    model: Model<Types>,
    tab: TabNode<"chart", ChartData>,
    change: Partial<ChartData>,
) {
    model.run("tab.set-data", { tabId: tab.id, data: change });
}

export default function ActiveTabControls() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <>
            <Toolbar model={model} />
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
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return (
                <ChartPanel
                    // keyed on the kind: a pie and a line are different charts
                    key={tab.data.kind}
                    kind={tab.data.kind}
                    seed={tab.data.seed}
                    title={tab.label}
                />
            );
        case "table":
            return <TablePanel />;
    }
}

/** The toolbar outside the layout: it follows the current tab, and a commit re-renders it, not the layout. */
function Toolbar({ model }: { model: Model<Types> }) {
    const tab = useModelState(() => currentTab(model), { model });
    const chart = tab?.component === "chart" ? tab : undefined;
    return (
        <div className={styles.toolbar}>
            <p role="status" data-testid="target" className={styles.target}>
                {chart
                    ? `Editing ${chart.label}`
                    : `${tab?.label ?? "No tab"}: not a chart`}
            </p>
            <fieldset
                aria-label="Chart kind"
                disabled={!chart}
                className={styles.segments}
            >
                {KINDS.map(({ kind, label, Icon }) => (
                    <button
                        key={kind}
                        type="button"
                        aria-label={label}
                        aria-pressed={chart?.data.kind === kind}
                        className={styles.segment}
                        onClick={() =>
                            chart && updateChart(model, chart, { kind })
                        }
                    >
                        <Icon aria-hidden="true" className={styles.icon} />
                    </button>
                ))}
            </fieldset>
            <button
                type="button"
                disabled={!chart}
                className={styles.button}
                onClick={() =>
                    chart &&
                    updateChart(model, chart, { seed: chart.data.seed + 1 })
                }
            >
                <Shuffle aria-hidden="true" className={styles.icon} />
                New data
            </button>
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

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}
