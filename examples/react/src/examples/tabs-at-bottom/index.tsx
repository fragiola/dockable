"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { PanelBottom, PanelTop } from "lucide-react";
import { useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        table: undefined;
        chart: { kind: ChartKind; seed: number };
        log: undefined;
        kpi: { seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "table", label: "Sheet 1" },
                    {
                        component: "chart",
                        label: "Sheet 2",
                        data: { kind: "bar", seed: 5 },
                    },
                    {
                        component: "chart",
                        label: "Sheet 3",
                        data: { kind: "donut", seed: 12 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "log", label: "Console" },
                    { component: "kpi", label: "Watch", data: { seed: 21 } },
                ],
            },
        ],
    },
};

type Position = "top" | "bottom";

export default function TabsAtBottom() {
    const [model] = useState(() => createModel<Types>(json));
    const [position, setPosition] = useState<Position>("bottom");
    const bottom = position === "bottom";

    const renderNode = (node: TabsetNode<Types> | RowNode<Types>) =>
        node.type === "row" ? (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        ) : (
            <TabSet node={node} position={position} />
        );

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <span className={styles.toolbarLabel}>Tabs</span>
                {(["top", "bottom"] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={position === value}
                        className={styles.button}
                        onClick={() => setPosition(value)}
                    >
                        {value === "top" ? (
                            <PanelTop
                                aria-hidden
                                className={styles.buttonIcon}
                            />
                        ) : (
                            <PanelBottom
                                aria-hidden
                                className={styles.buttonIcon}
                            />
                        )}
                        {value === "top" ? "Top" : "Bottom"}
                    </button>
                ))}
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel
                                node={tab}
                                className={styles.panel(bottom)}
                            >
                                <Content tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "table":
            return <TablePanel />;
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.data.seed}
                    title={tab.label}
                />
            );
        case "log":
            return <LogPanel />;
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
    }
}

/**
 * A tabset is a flex column (`Dockable.TabSet` sets `display: flex; flex-direction: column`),
 * and `Dockable.TabSetContent` takes the space left over. So the strip goes below the content
 * just by coming after it in the markup: the engine measures the content area wherever it is
 * and positions the panel over it.
 */
function TabSet({
    node,
    position,
}: {
    node: TabsetNode<Types>;
    position: Position;
}) {
    const bottom = position === "bottom";
    const strip = (
        <div className={styles.strip(bottom)}>
            <Dockable.TabList<Types>
                aria-label="Tabs"
                className={styles.tabList}
            >
                {(tab) => (
                    <Dockable.Tab node={tab} className={styles.tab(bottom)}>
                        <span className={styles.tabName}>{tab.label}</span>
                        {/* the active tabset's marker, on the edge that meets the content */}
                        <span
                            aria-hidden="true"
                            className={styles.tabMarker(bottom)}
                        />
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </div>
    );
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            {bottom ? null : strip}
            <Dockable.TabSetContent />
            {bottom ? strip : null}
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
