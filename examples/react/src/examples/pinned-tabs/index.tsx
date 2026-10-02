"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import {
    Calendar,
    FileText,
    House,
    type LucideIcon,
    Mail,
    Pin,
    PinOff,
    X,
} from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// Pinned tabs: kept at the start of the strip by the model, shown as icons, and not closable
// (`model.can("tab.close", …)` refuses a pinned tab). The styles read `data-pinned` on the tab.

// Every component carries the icon its tab shows when pinned.
type TabData = { icon?: string };
type Types = {
    tabs: {
        chart: TabData & { kind: ChartKind; seed: number };
        kpi: TabData & { seed: number; unit?: string };
        table: TabData;
        doc: TabData & { text: string };
    };
};

const ICONS: Record<string, LucideIcon> = {
    home: House,
    mail: Mail,
    calendar: Calendar,
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
                    {
                        component: "chart",
                        label: "Home",
                        pinned: true,
                        data: {
                            icon: "home",
                            kind: "area",
                            seed: 4,
                        },
                    },
                    {
                        component: "table",
                        label: "Mail",
                        pinned: true,
                        data: { icon: "mail" },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: {
                            icon: "calendar",
                            kind: "bar",
                            seed: 12,
                        },
                    },
                    {
                        component: "chart",
                        label: "Report.pdf",
                        data: { kind: "donut", seed: 8 },
                    },
                    {
                        component: "kpi",
                        label: "Budget.xlsx",
                        data: { seed: 15, unit: "$" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    {
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "Pin or unpin the selected tab with the pin button in the header.",
                        },
                    },
                    {
                        component: "doc",
                        label: "Drafts",
                        data: {
                            text: "A pinned tab moves to the start of the strip and loses its close button.",
                        },
                    },
                ],
            },
        ],
    },
};

export default function PinnedTabs() {
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

/** A tabset: the strip of tabs and the pin button on top, the measured content area below. */
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
                            <TabLabel tab={tab} />
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.toolbar}>
                    <PinButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
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
            return (
                <KpiPanel
                    label={tab.label}
                    seed={tab.data.seed}
                    unit={tab.data.unit}
                />
            );
        case "table":
            return <TablePanel />;
        case "doc":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.panelText}>{tab.data.text}</p>
                </PanelBody>
            );
    }
}

/** The inside of a tab: an icon when pinned (the name is kept for screen readers). */
function TabLabel({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    const Icon = ICONS[tab.data.icon ?? ""] ?? FileText;
    if (tab.pinned === true) {
        return (
            <>
                <Icon aria-hidden className={styles.tabIcon} />
                <span className={styles.tabNameHidden}>{tab.label}</span>
            </>
        );
    }
    return (
        <>
            <span className={styles.tabName}>{tab.label}</span>
            {model.can("tab.close", { tabId: tab.id }) ? (
                <button
                    type="button"
                    // the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard
                    tabIndex={-1}
                    aria-label={`Close ${tab.label}`}
                    className={styles.closeButton}
                    onClick={(event) => {
                        event.stopPropagation(); // a click on the tab would select it
                        model.run("tab.close", { tabId: tab.id });
                    }}
                >
                    <X aria-hidden className={styles.closeIcon} />
                </button>
            ) : null}
        </>
    );
}

/** Pins or unpins the tabset's selected tab. */
function PinButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const selected = model.get("selected-tab-by", {
        tabsetId: tabset.id,
    });
    if (!selected) {
        return null;
    }
    const pinned = selected.pinned === true;
    return (
        <button
            type="button"
            aria-label={`${pinned ? "Unpin" : "Pin"} ${selected.label}`}
            aria-pressed={pinned}
            className={styles.button}
            onClick={() =>
                model.run("tab.pin", { tabId: selected.id, value: !pinned })
            }
        >
            {pinned ? (
                <PinOff aria-hidden className={styles.buttonIcon} />
            ) : (
                <Pin aria-hidden className={styles.buttonIcon} />
            )}
        </button>
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
