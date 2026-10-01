"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { PanelBottom, PanelTop } from "lucide-react";
import { useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        table: { name: string };
        chart: { name: string; kind: ChartKind; seed: number };
        log: { name: string };
        kpi: { name: string; seed: number };
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
                    { component: "table", data: { name: "Sheet 1" } },
                    {
                        component: "chart",
                        data: { name: "Sheet 2", kind: "bar", seed: 5 },
                    },
                    {
                        component: "chart",
                        data: { name: "Sheet 3", kind: "donut", seed: 12 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "log", data: { name: "Console" } },
                    { component: "kpi", data: { name: "Watch", seed: 21 } },
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

    /** A row's child: a tabset, or a nested row rendered by this same function. */
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
            {/* The root needs a size: the wrapper gives it one, and the gutter around it. */}
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
                                {tab.component === "table" ? (
                                    <TablePanel />
                                ) : tab.component === "chart" ? (
                                    <ChartPanel
                                        kind={tab.data.kind}
                                        seed={tab.data.seed}
                                        title={tab.data.name}
                                    />
                                ) : tab.component === "log" ? (
                                    <LogPanel />
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
        </div>
    );
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
                        <span className={styles.tabName}>{tab.data.name}</span>
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
