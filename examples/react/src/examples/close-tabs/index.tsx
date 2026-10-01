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
import { Inbox, Lock, X } from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        chart: { name: string; kind: ChartKind; seed: number };
        kpi: { name: string; seed: number };
        doc: { name: string; text: string };
        table: { name: string };
        log: { name: string };
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
                        data: { name: "Home", kind: "area", seed: 3 },
                        enableClose: false,
                    },
                    {
                        component: "chart",
                        data: { name: "Report", kind: "bar", seed: 17 },
                    },
                    {
                        component: "doc",
                        data: {
                            name: "Draft",
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
                        children: [
                            { component: "table", data: { name: "Inbox" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "log", data: { name: "Logs" } },
                            {
                                component: "kpi",
                                data: { name: "Metrics", seed: 21 },
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

/** A tab's content: `tab.data` and the component narrow together. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.data.seed}
                    title={tab.data.name}
                />
            );
        case "kpi":
            return <KpiPanel label={tab.data.name} seed={tab.data.seed} />;
        case "doc":
            return (
                <PanelBody title={tab.data.name}>
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
            <span className={styles.tabName}>{tab.data.name}</span>
            {closeable ? (
                <button
                    type="button"
                    // the keyboard closes with Ctrl+Delete on the tab itself (the keyMap's
                    // closeTab), so the button is left out of the tab order
                    tabIndex={-1}
                    aria-label={`Close ${tab.data.name}`}
                    className={styles.closeButton}
                    // keep the press from selecting the tab or starting a drag
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        close();
                    }}
                >
                    <X aria-hidden className={styles.closeIcon} />
                </button>
            ) : (
                <Lock aria-hidden className={styles.lockIcon} />
            )}
            {/* the active tabset's marker */}
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
