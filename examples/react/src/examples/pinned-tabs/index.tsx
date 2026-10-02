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
// Whether a tab offers the pin button is the app's choice: here, `enablePin` in its data.

// Every component carries the tab's icon when pinned, and whether it offers the pin.
type TabData = { icon?: string; enablePin: boolean };
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
                            enablePin: true,
                            kind: "area",
                            seed: 4,
                        },
                    },
                    {
                        component: "table",
                        label: "Mail",
                        pinned: true,
                        data: { icon: "mail", enablePin: true },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: {
                            icon: "calendar",
                            enablePin: true,
                            kind: "bar",
                            seed: 12,
                        },
                    },
                    {
                        component: "chart",
                        label: "Report.pdf",
                        data: { enablePin: true, kind: "donut", seed: 8 },
                    },
                    {
                        component: "kpi",
                        label: "Budget.xlsx",
                        data: { enablePin: true, seed: 15, unit: "$" },
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
                            enablePin: true,
                            text: "Pin or unpin the selected tab with the pin button in the header.",
                        },
                    },
                    {
                        component: "doc",
                        label: "Drafts",
                        data: {
                            enablePin: true,
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
                {/* Where a dragged tab would land, animated at the layout's drag speed. */}
                <Dockable.DropIndicator
                    className={styles.dropIndicator}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
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
                            {/* the active tabset's marker */}
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

/** A tab's content: `tab.data` and the component narrow together. */
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
                    // the tab is the tab stop; the close button is reached with the mouse
                    // (the keyboard closes with Ctrl+Delete on the tab)
                    tabIndex={-1}
                    aria-label={`Close ${tab.label}`}
                    className={styles.closeButton}
                    onClick={(event) => {
                        event.stopPropagation(); // not a click on the tab
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
    if (!selected?.data.enablePin) {
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
