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
import { PanelBody } from "../_kit/card";
import { ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        doc: { text: string };
        chart: { seed: number };
        kpi: { seed: number };
        table: undefined;
        log: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    // the active tabset when the layout loads (the layout's, by id)
    active: "editors",
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "editors",
                weight: 50,
                children: [
                    {
                        component: "doc",
                        label: "Editor",
                        data: {
                            text: "Revenue grew in every region this quarter, led by the new self-serve plan. The chart in Preview follows the figures as they are edited.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Preview",
                        data: { seed: 5 },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "doc",
                                label: "Outline",
                                data: {
                                    text: "Summary · Revenue · Customers · Outlook",
                                },
                            },
                            { component: "table", label: "Search" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Problems",
                                data: { seed: 13 },
                            },
                            { component: "log", label: "Output" },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function FocusedTab() {
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
        case "doc":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.panelText}>{tab.data.text}</p>
                </PanelBody>
            );
        case "chart":
            return (
                <ChartPanel
                    kind="line"
                    seed={tab.data.seed}
                    title={tab.label}
                />
            );
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
        case "table":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
    }
}

/**
 * A tabset: a card with the strip of tabs on top and the measured content area below.
 *
 * The focused tab is the selected tab of the active tabset. `data-active` is on the active
 * `Dockable.TabSet`, `data-selected` on each tabset's selected `Dockable.Tab`; a tab does not know
 * whether its tabset is active, so its classes read the tabset's attribute from an ancestor with
 * `in-data-active:` (`:where([data-active]) &`). That is the workaround for gap 1 (no
 * `data-tabset-active` on `Tab`), and it works in any CSS: `[data-active] [data-selected] { … }`.
 */
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
