"use client";

import {
    type CommandResult,
    createModel,
    Dockable,
    type LayoutJson,
    MAIN_LAYOUT,
    type Model,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useModelState,
} from "@fragiola/dockable-react";
import { type ReactNode, useState } from "react";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// The layout driven from code. The panel on the left lists the tabsets and their tabs
// (`model.get("tabsets")`, re-read on every commit) and runs commands on the tab you are looking
// at and its tabset. Each button asks the model first: `model.check` is the dry run of the same
// command, so a refused one is disabled and says why (a pinned tab cannot close or move, the
// right tabset cannot close, a tabset alone in its layout cannot maximize). The last result shows
// below. Nothing here touches the DOM: the layout follows the model.

type Types = {
    tabs: {
        chart: { kind: "line" | "bar" | "area" | "donut" };
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
                id: "left",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Overview",
                        data: { kind: "area" },
                        pinned: true,
                    },
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 50,
                enableClose: false,
                children: [
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "donut" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line" },
                    },
                ],
            },
        ],
    },
};

/** The tabsets' names in the panel: the two of the JSON, then a number for each new one. */
function tabsetName(tabset: TabsetNode<Types>, index: number) {
    if (tabset.id === "left") return "Left";
    if (tabset.id === "right") return "Right";
    return `Tabset ${index + 1}`;
}

export default function RemoteControl() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.page}>
            <RemotePanel model={model} />
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
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
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
    }
}

/**
 * The panel beside the layout: it reads a new snapshot on every commit, and the dry runs below
 * with it. A component of its own, so a commit re-renders it, not the layout.
 */
function RemotePanel({ model }: { model: Model<Types> }) {
    const [last, setLast] = useState("No command yet");
    const { tabsets, tabset, tab, maximized } = useModelState(
        () => {
            const tabset = model.get("default-tabset");
            return {
                tabsets: model.get("tabsets"),
                tabset,
                tab: tabset
                    ? model.get("selected-tab-by", { tabsetId: tabset.id })
                    : undefined,
                maximized:
                    tabset !== undefined &&
                    model.is("tabset-maximized", { tabsetId: tabset.id }),
            };
        },
        { model },
    );
    /** Runs a command and reports its result in the status line. */
    const report = (command: string, result: CommandResult<unknown>) =>
        setLast(
            result.ok
                ? `${command}: done`
                : `${command}: ${result.error.code} (${result.error.message})`,
        );
    return (
        <aside aria-label="Remote control" className={styles.remote}>
            <section className={styles.section}>
                <h2 className={styles.heading}>Layout</h2>
                {tabsets.map((node, index) => (
                    <div key={node.id} className={styles.tree}>
                        <button
                            type="button"
                            aria-pressed={node.id === tabset?.id}
                            className={styles.treeTabset}
                            onClick={() =>
                                report(
                                    "tabset.activate",
                                    model.run("tabset.activate", {
                                        tabsetId: node.id,
                                    }),
                                )
                            }
                        >
                            {tabsetName(node, index)}
                        </button>
                        {node.children.map((child) => (
                            <button
                                key={child.id}
                                type="button"
                                aria-pressed={
                                    child.id ===
                                    model.get("selected-tab-by", {
                                        tabsetId: node.id,
                                    })?.id
                                }
                                className={styles.treeTab}
                                onClick={() =>
                                    report(
                                        "tab.select",
                                        model.run("tab.select", {
                                            tabId: child.id,
                                        }),
                                    )
                                }
                            >
                                {child.label}
                            </button>
                        ))}
                    </div>
                ))}
            </section>
            {tab && tabset ? (
                <>
                    <section className={styles.section}>
                        <h2 className={styles.heading}>
                            {`Tab: ${tab.label}`}
                        </h2>
                        {tabsets
                            .filter((other) => other.id !== tabset.id)
                            .map((other) => {
                                const payload = {
                                    tabId: tab.id,
                                    to: other.id,
                                };
                                return (
                                    <Action
                                        key={other.id}
                                        dryRun={model.check(
                                            "tab.move",
                                            payload,
                                        )}
                                        onClick={() =>
                                            report(
                                                "tab.move",
                                                model.run("tab.move", payload),
                                            )
                                        }
                                    >
                                        {`Move to ${tabsetName(other, tabsets.indexOf(other))}`}
                                    </Action>
                                );
                            })}
                        <Action
                            // `to` a layout id with an edge docks beside the whole layout
                            dryRun={model.check("tab.move", {
                                tabId: tab.id,
                                to: MAIN_LAYOUT,
                                location: "bottom",
                            })}
                            onClick={() =>
                                report(
                                    "tab.move",
                                    model.run("tab.move", {
                                        tabId: tab.id,
                                        to: MAIN_LAYOUT,
                                        location: "bottom",
                                    }),
                                )
                            }
                        >
                            Dock at the bottom
                        </Action>
                        <Action
                            dryRun={model.check("tab.close", {
                                tabId: tab.id,
                            })}
                            onClick={() =>
                                report(
                                    "tab.close",
                                    model.run("tab.close", {
                                        tabId: tab.id,
                                    }),
                                )
                            }
                        >
                            Close tab
                        </Action>
                    </section>
                    <section className={styles.section}>
                        <h2 className={styles.heading}>
                            {`Tabset: ${tabsetName(tabset, tabsets.indexOf(tabset))}`}
                        </h2>
                        <Action
                            dryRun={model.check("tabset.maximize", {
                                tabsetId: tabset.id,
                                value: !maximized,
                            })}
                            onClick={() =>
                                report(
                                    "tabset.maximize",
                                    model.run("tabset.maximize", {
                                        tabsetId: tabset.id,
                                        value: !maximized,
                                    }),
                                )
                            }
                        >
                            {maximized ? "Restore" : "Maximize"}
                        </Action>
                        <Action
                            // an edge of a tabset splits it: the new tab gets a tabset of its own
                            dryRun={model.check("tab.add", {
                                component: "table",
                                label: "New table",
                                to: tabset.id,
                                location: "end",
                            })}
                            onClick={() =>
                                report(
                                    "tab.add",
                                    model.run("tab.add", {
                                        component: "table",
                                        label: `Table ${model.get("all-tabs").length + 1}`,
                                        to: tabset.id,
                                        location: "end",
                                        select: true,
                                    }),
                                )
                            }
                        >
                            Add a tab beside
                        </Action>
                        <Action
                            dryRun={model.check("tabset.close", {
                                tabsetId: tabset.id,
                            })}
                            onClick={() =>
                                report(
                                    "tabset.close",
                                    model.run("tabset.close", {
                                        tabsetId: tabset.id,
                                    }),
                                )
                            }
                        >
                            Close tabset
                        </Action>
                    </section>
                </>
            ) : null}
            <p role="status" data-testid="last" className={styles.status}>
                {last}
            </p>
        </aside>
    );
}

/**
 * A command button: disabled when its dry run (`model.check`) is refused, with the reason as its
 * tooltip. `model.can` answers the same question with a boolean; `check` also says why.
 */
function Action({
    dryRun,
    onClick,
    children,
}: {
    dryRun: CommandResult<unknown>;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            disabled={!dryRun.ok}
            title={dryRun.ok ? undefined : dryRun.error.message}
            className={styles.action}
            onClick={onClick}
        >
            {children}
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

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}
