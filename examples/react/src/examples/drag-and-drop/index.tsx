"use client";

import {
    createModel,
    type DropLocation,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// Drag tabs between tabsets and to the layout's edges. The drop indicator is styled from its state:
// blue for a drop into a tabset (`kind: "rect"`), a dashed orange band for a drop at the layout's
// edge (`kind: "edge"`), an arrow for the side, and a transition as long as the root's
// `tabDragSpeed`. During a drag the edge indicators (Dockable.EdgeIndicator) mark the four bands
// where a drop docks to an edge.

// What the layout holds: one component per kind of content, each named by its label.
type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
        table: undefined;
        log: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Drag me",
                        data: { kind: "area", seed: 4 },
                    },
                    { component: "kpi", label: "Or me", data: { seed: 15 } },
                    {
                        component: "chart",
                        label: "Me too",
                        data: { kind: "donut", seed: 9 },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Inbox" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "log", label: "Outbox" }],
                    },
                ],
            },
        ],
    },
};

const ARROWS: Partial<Record<DropLocation, typeof ArrowUp>> = {
    top: ArrowUp,
    bottom: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
};

const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["left", ArrowLeft],
    ["right", ArrowRight],
] as const;

export default function DragAndDrop() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
        <div className={styles.frame}>
            <Dockable.Root
                model={model}
                // how long the indicator may take to move to the next target (exposed as data)
                tabDragSpeed={0.2}
                // while a tab of this layout is dragged, the panels fade back
                className={styles.root}
            >
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
                {/* Where a dragged tab would land, animated at the layout's drag speed. */}
                <Dockable.DropIndicator
                    className={styles.dropIndicator}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                    // a render function gets the state too: an arrow for the side it docks to
                    render={(props, state) => {
                        const Arrow = ARROWS[state.location];
                        return (
                            <div {...props}>
                                {Arrow ? (
                                    <Arrow className={styles.dropArrow} />
                                ) : null}
                            </div>
                        );
                    }}
                />
                {/* the edge docking targets, shown during a drag (solid under the pointer) */}
                {EDGES.map(([edge, Arrow]) => (
                    <Dockable.EdgeIndicator
                        key={edge}
                        edge={edge}
                        className={styles.edgeIndicator}
                    >
                        <Arrow
                            aria-hidden="true"
                            className={styles.edgeArrow}
                        />
                    </Dockable.EdgeIndicator>
                ))}
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

/**
 * A tabset. The one the drag would drop into (or beside) has `data-drop-target` (and
 * `data-drop-location`), so it is styled from data alone.
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
