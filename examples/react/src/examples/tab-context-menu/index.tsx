"use client";

import {
    type BatchEntry,
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { ContextMenu } from "#/components/ui/context-menu";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// A Fragiola ContextMenu on every tab. The package provides the commands and `model.can`, which
// says whether a command would apply; the menu (and its text) is the consumer's. The tab IS the
// menu's trigger: `render` puts the Dockable.Tab's props onto ContextMenu.Trigger's element.

type Types = {
    tabs: {
        note: { text: string };
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
        log: undefined;
        table: undefined;
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
                    {
                        component: "note",
                        label: "Overview",
                        data: {
                            text: "Right-click a tab (or long-press it) for its menu.",
                        },
                    },
                    {
                        component: "note",
                        label: "Settings",
                        data: {
                            text: "This tab cannot be closed: Close is disabled in its menu.",
                        },
                        // not closable: `tab.close` refuses it, so Close is disabled in its menu
                        closable: false,
                    },
                    { component: "log", label: "Activity" },
                    {
                        component: "chart",
                        label: "Reports",
                        data: { kind: "bar", seed: 21 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "table", label: "Inbox" },
                    { component: "kpi", label: "Drafts", data: { seed: 6 } },
                ],
            },
        ],
    },
};

export default function TabContextMenu() {
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

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "note":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.hint}>{tab.data.text}</p>
                </PanelBody>
            );
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
        case "log":
            return <LogPanel />;
        case "table":
            return <TablePanel />;
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
                    {(tab) => <MenuTab tab={tab} />}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

function MenuTab({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();

    // a tab lives in a tabset or a border; maximize is a tabset's
    const parent = model.get("node-parent-by", { nodeId: tab.id });
    const tabset = parent?.type === "tabset" ? parent : undefined;
    const siblings = parent && parent.type !== "row" ? parent.children : [];
    const right = siblings.slice(
        siblings.findIndex((t) => t.id === tab.id) + 1,
    );
    // what a command would do, asked without applying it (middleware included)
    const closable = (tabs: readonly TabOf<Types>[]) =>
        tabs.filter((t) => model.can("tab.close", { tabId: t.id }));
    const others = closable(siblings.filter((t) => t.id !== tab.id));
    const toTheRight = closable(right);
    const pinned = tab.pinned === true;
    const maximized =
        tabset !== undefined &&
        model.is("tabset-maximized", { tabsetId: tabset.id });
    // several closes are one command (one change event, one undo step): all apply or none
    const closeAll = (tabs: readonly TabOf<Types>[]) =>
        model.run("batch", {
            commands: tabs.map(
                (t): BatchEntry<Types> => ({
                    command: "tab.close",
                    payload: { tabId: t.id },
                }),
            ),
        });

    return (
        <ContextMenu.Root>
            <Dockable.Tab
                node={tab}
                render={<ContextMenu.Trigger />}
                className={styles.tab}
            >
                <span className={styles.tabName}>{tab.label}</span>
            </Dockable.Tab>
            <ContextMenu.Content>
                <ContextMenu.Item
                    disabled={!model.can("tab.close", { tabId: tab.id })}
                    onClick={() => model.run("tab.close", { tabId: tab.id })}
                >
                    Close
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={others.length === 0}
                    onClick={() => closeAll(others)}
                >
                    Close others
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={toTheRight.length === 0}
                    onClick={() => closeAll(toTheRight)}
                >
                    Close to the right
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item
                    // refused for a tab in a border (only a tabset has a pinned run)
                    disabled={
                        !model.can("tab.pin", { tabId: tab.id, value: !pinned })
                    }
                    onClick={() =>
                        model.run("tab.pin", { tabId: tab.id, value: !pinned })
                    }
                >
                    {pinned ? "Unpin" : "Pin"}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={
                        !tabset ||
                        !model.can("tabset.maximize", {
                            tabsetId: tabset.id,
                            value: !maximized,
                        })
                    }
                    onClick={() => {
                        if (tabset) {
                            model.run("tabset.maximize", {
                                tabsetId: tabset.id,
                                value: !maximized,
                            });
                        }
                    }}
                >
                    {maximized ? "Restore tabset" : "Maximize tabset"}
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
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
