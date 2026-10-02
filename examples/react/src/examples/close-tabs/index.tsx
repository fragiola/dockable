"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-react";
import { Inbox, Lock, X } from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
        doc: { text: string };
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
                weight: 55,
                children: [
                    // this one has no close button, and ignores middle-click and Ctrl+Delete
                    {
                        component: "chart",
                        label: "Home",
                        data: { kind: "area", seed: 3 },
                        enableClose: false,
                    },
                    {
                        component: "chart",
                        label: "Report",
                        data: { kind: "bar", seed: 17 },
                    },
                    {
                        component: "doc",
                        label: "Draft",
                        data: {
                            text: "Q3 planning: ship the billing page, then the team settings. Close this tab when the plan is agreed.",
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        // an empty tabset stays, and shows a hint, instead of disappearing
                        deleteWhenEmpty: false,
                        children: [{ component: "table", label: "Inbox" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "log", label: "Logs" },
                            {
                                component: "kpi",
                                label: "Metrics",
                                data: { seed: 21 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function CloseTabs() {
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
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
        case "doc":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.panelText}>{tab.data.text}</p>
                </PanelBody>
            );
        case "table":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
    }
}

function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => <ClosableTab tab={tab} />}
                </Dockable.TabList>
                <div className={styles.toolbar}>
                    <CloseTabsetButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent
                // No panel covers an empty tabset's content area, so it can show a hint.
                // `render` gets the element's props (its `ref` fits any element) and its state
                // ({ empty }).
                render={(props, state) => (
                    <div {...props}>
                        {state.empty ? (
                            <div className={styles.emptyHint}>
                                <Inbox
                                    aria-hidden
                                    className={styles.emptyIcon}
                                />
                                <p>Nothing open. Drag a tab here.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            />
        </Dockable.TabSet>
    );
}

/** A tab with its own close button, closed by a middle click too. */
function ClosableTab({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    // whether `tab.close` would apply: the tab's `enableClose` (resolved against the layout
    // defaults), not pinned, and no middleware veto. A dry run: nothing changes.
    const closeable = model.can("tab.close", { tabId: tab.id });
    const close = () => model.run("tab.close", { tabId: tab.id });
    return (
        <Dockable.Tab
            node={tab}
            className={styles.tab}
            onAuxClick={(event) => {
                if (event.button === 1 && closeable) {
                    event.preventDefault();
                    close();
                }
            }}
        >
            <span className={styles.tabName}>{tab.label}</span>
            {closeable ? (
                <button
                    type="button"
                    // the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard
                    tabIndex={-1}
                    aria-label={`Close ${tab.label}`}
                    className={styles.closeButton}
                    // keeps the press from activating the tabset
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation(); // a click on the tab would select it
                        close();
                    }}
                >
                    <X aria-hidden className={styles.closeIcon} />
                </button>
            ) : (
                <Lock aria-hidden className={styles.lockIcon} />
            )}
            <span aria-hidden="true" className={styles.tabMarker} />
        </Dockable.Tab>
    );
}

function CloseTabsetButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    if (tabset.children.length === 0) return null;
    return (
        <button
            type="button"
            aria-label="Close tabset"
            className={styles.button}
            // closes every closeable tab; the tabset goes too once it is empty
            onClick={() => model.run("tabset.close", { tabsetId: tabset.id })}
        >
            <X aria-hidden className={styles.buttonIcon} />
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
