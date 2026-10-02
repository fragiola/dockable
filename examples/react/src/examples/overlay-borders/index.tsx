"use client";

import {
    type BorderNode,
    createModel,
    Dockable,
    type LayoutJson,
    type Model,
    type RowNode,
    type SplitterProps,
    type TabOf,
    type TabsetNode,
    useModelState,
} from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// Overlay borders (`mode: "overlay"`) open over the layout instead of beside it, and close on a
// press elsewhere in the layout or on Escape (keyMap.closeOverlayBorder). The toolbar switches a
// border's mode with the `border.configure` command. The end border is empty and `autoHide`: it
// shows up while a tab is dragged near the layout's end edge, so it can take the drop. The edge
// indicators (Dockable.EdgeIndicator) mark where a drop docks to an edge instead.

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
    defaults: { border: { size: 240 } },
    borders: [
        {
            location: "start",
            mode: "overlay",
            children: [
                { component: "kpi", label: "Inbox", data: { seed: 17 } },
                {
                    component: "doc",
                    label: "Drafts",
                    data: {
                        text: "Hi team, the release notes are attached. Let me know before Friday if anything is missing.",
                    },
                },
            ],
        },
        {
            location: "bottom",
            mode: "overlay",
            size: 180,
            children: [{ component: "log", label: "Console" }],
        },
        {
            location: "end",
            autoHide: true,
            children: [],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "doc",
                        label: "Message",
                        data: {
                            text: "The left and bottom borders open over this layout without resizing it. Press elsewhere in the layout, or Escape, to close them.",
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
                type: "tabset",
                weight: 40,
                children: [{ component: "table", label: "Contacts" }],
            },
        ],
    },
};

const SWITCHABLE = ["start", "bottom"] as const;

// the four edge docking targets, each with an arrow pointing at its edge
const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["start", ArrowLeft],
    ["end", ArrowRight],
] as const;

export default function OverlayBorders() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.page}>
            <Toolbar model={model} />
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Borders<Types>
                        renderBar={(border) => <Border node={border} />}
                        renderContent={(border) => (
                            <BorderContent node={border} />
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
                    {/* The band along each layout edge where a drop docks to that edge, shown
                        during a drag. */}
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
                    <p>{tab.data.text}</p>
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

/** The toolbar outside the layout: it follows the borders, and a commit re-renders it, not the layout. */
function Toolbar({ model }: { model: Model<Types> }) {
    const borders = useModelState(() => model.get("borders"), { model });
    return (
        <div className={styles.toolbar}>
            {SWITCHABLE.map((location) => {
                const border = borders.find(
                    (candidate) => candidate.location === location,
                );
                return border ? (
                    <ModeSwitch key={location} model={model} border={border} />
                ) : null;
            })}
            <p className={styles.hint}>
                Drag a tab towards the right edge (above or below its middle) to
                reveal the hidden border.
            </p>
        </div>
    );
}

function ModeSwitch({
    model,
    border,
}: {
    model: Model<Types>;
    border: BorderNode<Types>;
}) {
    // the border's mode, resolved against the layout defaults
    const overlay = model.is("border-overlay", { borderId: border.id });
    const name = border.location;
    return (
        <button
            type="button"
            data-testid={`type-${name}`}
            className={styles.modeButton}
            aria-pressed={overlay}
            onClick={() =>
                model.run("border.configure", {
                    borderId: border.id,
                    mode: overlay ? "docked" : "overlay",
                })
            }
        >
            {`${name[0]?.toUpperCase()}${name.slice(1)}: ${overlay ? "overlay" : "split"}`}
        </button>
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

/** A border's strip: its tabs, in a row or a column depending on its side. */
function Border({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.Border node={node} className={styles.border}>
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

function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={styles.borderContent}
            renderSplitter={(border) => <Splitter node={border} />}
        />
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
