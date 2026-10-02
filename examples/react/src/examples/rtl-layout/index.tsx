"use client";

import {
    type BorderNode,
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type SplitterProps,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// A right-to-left page needs nothing from the layout: `dir="rtl"` on an ancestor of the root (here
// a wrapper; usually <html>) makes `start` the right side. The rows mirror (they are CSS flex), and
// the engine reads the root's direction, so splitters, arrow keys, side, edge and strip drops and
// overlay borders follow the screen. Flipping `dir` repositions the panels by itself.
//
// Two things stay yours: how a start border's labels read (its strip is on the right here, where
// labels read down, so it gets `tabDirection="down"`), and styles, written with logical
// properties (`ps-`, `border-e`, `start-`) so they mirror with the page.

type Types = {
    tabs: {
        kpi: { seed: number };
        doc: { text: string };
        chart: { kind: ChartKind };
        table: undefined;
        log: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "start",
            selected: 0,
            children: [
                { component: "kpi", label: "Inbox", data: { seed: 11 } },
                { component: "kpi", label: "Sent", data: { seed: 23 } },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [{ component: "log", label: "Console" }],
        },
        {
            location: "end",
            mode: "overlay",
            children: [
                {
                    component: "doc",
                    label: "Notes",
                    data: {
                        text: "An overlay border on the end side: on the left in RTL, over the layout.",
                    },
                },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        component: "doc",
                        label: "Message",
                        data: {
                            text: "Start is on the right: this tabset comes first, and its first tab is the rightmost. Drag the splitter, or focus it and press the arrow keys: it moves the way they point. Drag a tab near the right edge to dock it at the start.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: { kind: "bar" },
                    },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Contacts" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Traffic",
                                data: { kind: "line" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

// the edge docking targets; the start and end arrows turn with the page (`rtl:` in styles.ts)
const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["start", ArrowLeft],
    ["end", ArrowRight],
] as const;

export default function RtlLayout() {
    const [model] = useState(() => createModel<Types>(json));
    const [dir, setDir] = useState<"rtl" | "ltr">("rtl");
    return (
        <div dir={dir} className={styles.page}>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    data-testid="direction"
                    className={styles.button}
                    aria-pressed={dir === "rtl"}
                    onClick={() => setDir(dir === "rtl" ? "ltr" : "rtl")}
                >
                    Right to left
                </button>
                <p dir="auto" className={styles.hint}>
                    Toggle it: the panels follow the tabsets, and start switches
                    sides.
                </p>
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Borders<Types>
                        renderBar={(border) => (
                            <Border
                                node={border}
                                tabDirection={dir === "rtl" ? "down" : "up"}
                            />
                        )}
                        renderContent={(border) => (
                            <Dockable.BorderContent
                                node={border}
                                className={styles.borderContent}
                                renderSplitter={(node) => (
                                    <Splitter node={node} />
                                )}
                            />
                        )}
                    >
                        <Dockable.Row<Types>
                            renderSplitter={(props) => <Splitter {...props} />}
                        >
                            {renderNode}
                        </Dockable.Row>
                    </Dockable.Borders>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <Content tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
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
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
        case "doc":
            return (
                <PanelBody title={tab.label}>
                    {/* English in an RTL page: `dir="auto"` keeps its full stop at its end */}
                    <p dir="auto">{tab.data.text}</p>
                </PanelBody>
            );
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.label.length}
                    title={tab.label}
                />
            );
        case "table":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
    }
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
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A border's strip. The start border's labels read down on the right, up on the left. */
function Border({
    node,
    tabDirection,
}: {
    node: BorderNode<Types>;
    tabDirection: "up" | "down";
}) {
    return (
        <Dockable.Border
            node={node}
            tabDirection={tabDirection}
            className={styles.border}
        >
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab node={tab} className={styles.borderTab}>
                        {tab.label}
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

function Splitter(props: SplitterProps<Types>) {
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
