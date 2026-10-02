"use client";

import {
    type BorderNode,
    type ComponentOf,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type SplitterProps } from "@fragiola/dockable-react";
import {
    Bell,
    Bookmark,
    FileText,
    ListTree,
    type LucideIcon,
    Search,
} from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel } from "../_kit/charts";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// A side border's tabs read vertically here by default (writing-mode, and half a turn more on a
// left border that reads "up"; see `Border` below). Nothing in the package imposes it:
// Dockable.Border only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

// The side panels serve a report: its outline, a search through it, bookmarks, notes and the
// alerts behind its figures.
type Types = {
    tabs: {
        outline: { headings: string[] };
        search: { query: string; results: string[] };
        bookmarks: { pages: string[] };
        notes: { text: string };
        alerts: undefined;
        document: { summary: string; kind: ChartKind };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "left",
            selected: 0,
            children: [
                {
                    component: "outline",
                    label: "Outline",
                    data: {
                        headings: ["Summary", "Revenue", "Orders", "Outlook"],
                    },
                },
                {
                    component: "search",
                    label: "Search",
                    data: {
                        query: "revenue",
                        results: [
                            "Summary: revenue grew for a third month",
                            "Revenue: by month",
                            "Outlook: revenue targets",
                        ],
                    },
                },
                {
                    component: "bookmarks",
                    label: "Bookmarks",
                    data: { pages: ["Revenue by month", "Refunded orders"] },
                },
            ],
        },
        {
            location: "right",
            children: [
                {
                    component: "notes",
                    label: "Notes",
                    data: {
                        text: "Check the June figures against the payment provider before sharing.",
                    },
                },
                { component: "alerts", label: "Alerts" },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        component: "document",
                        label: "Document",
                        data: {
                            summary:
                                "Revenue grew for a third month in a row, led by search and direct traffic. Refunds stayed under two percent of orders.",
                            kind: "bar",
                        },
                    },
                ],
            },
        ],
    },
};

// the side panels' icons, by component (the document tab has none)
const icons: { [K in ComponentOf<Types>]?: LucideIcon } = {
    outline: ListTree,
    search: Search,
    bookmarks: Bookmark,
    notes: FileText,
    alerts: Bell,
};

type Orientation = "vertical" | "horizontal";

export default function BorderTabOrientation() {
    const [model] = useState(() => createModel<Types>(json));
    const [orientation, setOrientation] = useState<Orientation>("vertical");
    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <fieldset className={styles.toggleGroup}>
                    <legend className={styles.legend}>
                        Side border labels
                    </legend>
                    {(["vertical", "horizontal"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`labels-${value}`}
                            aria-pressed={orientation === value}
                            className={styles.toggle}
                            onClick={() => setOrientation(value)}
                        >
                            {value === "vertical"
                                ? "Vertical labels"
                                : "Horizontal labels"}
                        </button>
                    ))}
                </fieldset>
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Borders<Types>
                        renderBar={(border) => (
                            <Border node={border} orientation={orientation} />
                        )}
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
                </Dockable.Root>
            </div>
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "outline":
            return (
                <PanelBody title={tab.label}>
                    <ol className={styles.list}>
                        {tab.data.headings.map((heading) => (
                            <li key={heading}>{heading}</li>
                        ))}
                    </ol>
                </PanelBody>
            );
        case "search":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.query}>{`“${tab.data.query}”`}</p>
                    <ul className={styles.list}>
                        {tab.data.results.map((result) => (
                            <li key={result}>{result}</li>
                        ))}
                    </ul>
                </PanelBody>
            );
        case "bookmarks":
            return (
                <PanelBody title={tab.label}>
                    <ul className={styles.list}>
                        {tab.data.pages.map((page) => (
                            <li key={page}>{page}</li>
                        ))}
                    </ul>
                </PanelBody>
            );
        case "notes":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.text}>{tab.data.text}</p>
                </PanelBody>
            );
        case "alerts":
            return <LogPanel />;
        case "document":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.text}>{tab.data.summary}</p>
                    <ChartPanel
                        kind={tab.data.kind}
                        seed={21}
                        className={styles.documentChart}
                    />
                </PanelBody>
            );
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
 * A border's strip and its tabs. `data-orientation` is the direction its tabs run, `data-location`
 * the side it is on. The orientation toggle changes only their classes (`styles.border`,
 * `styles.borderTab`).
 */
function Border({
    node,
    orientation,
}: {
    node: BorderNode<Types>;
    orientation: Orientation;
}) {
    const upright = orientation === "horizontal";
    return (
        <Dockable.Border node={node} className={styles.border(upright)}>
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab
                        node={tab}
                        className={styles.borderTab(upright)}
                    >
                        <Label tab={tab} />
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

function Label({ tab }: { tab: TabOf<Types> }) {
    const Icon = icons[tab.component];
    return (
        <>
            {Icon ? (
                <Icon aria-hidden="true" className={styles.labelIcon} />
            ) : null}
            {tab.label}
        </>
    );
}

function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
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
