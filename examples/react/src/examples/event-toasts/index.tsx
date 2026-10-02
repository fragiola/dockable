"use client";

import {
    type CommandEvent,
    type CommandName,
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";
import { type Toast, Toaster, useToasts } from "./toasts";

// The layout tells the app what happened: `model.subscribe` delivers one event per committed
// command, whoever issued it (a drag, a close button, a keyboard shortcut, the Add button). The app
// decides what deserves a reaction. Here: a toast per kind of command, each worded for that kind,
// and a closed tab's toast offers Undo, which adds the tab back where it was: the event carries
// the state before the close (`event.before`), where the tab, its tabset and its place are found.
// The switches mute kinds: the listener sees every command, the app picks.

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
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
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "area" },
                    },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Orders",
                                data: { seed: 3 },
                            },
                            {
                                component: "kpi",
                                label: "Refunds",
                                data: { seed: 12 },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Share",
                                data: { kind: "donut" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The kinds of command that can raise a toast, and the switch that mutes each. */
const KINDS = [
    { command: "tab.close", label: "Close" },
    { command: "tab.move", label: "Move" },
    { command: "tabset.maximize", label: "Maximize" },
    { command: "tab.add", label: "Add" },
    { command: "tab.select", label: "Select" },
] as const satisfies readonly { command: CommandName; label: string }[];

/**
 * A field of an event's payload or result. `CommandEvent` types both as `unknown` (one listener
 * sees every command), so the example reads the fields it needs and checks their type.
 */
function field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null
        ? Reflect.get(value, key)
        : undefined;
}

/** Where a tab is in a layout's state: its tabset and its place in the strip. */
interface Place {
    tab: TabOf<Types>;
    tabsetId: string;
    index: number;
}

/** Finds a tab in a row of a state: the event's `before` or `after`. */
function placeOf(row: RowNode<Types>, tabId: string): Place | undefined {
    for (const child of row.children) {
        if (child.type === "row") {
            const found = placeOf(child, tabId);
            if (found) return found;
            continue;
        }
        const index = child.children.findIndex((tab) => tab.id === tabId);
        const tab = child.children[index];
        if (tab) return { tab, tabsetId: child.id, index };
    }
    return undefined;
}

/** Adds a closed tab back where it was (its tabset, its place), or to the active tabset. */
function reopen(model: Model<Types>, { tab, tabsetId, index }: Place) {
    const home = model.get("node-by", { id: tabsetId });
    const to =
        home?.type === "tabset" ? home.id : model.get("default-tabset")?.id;
    if (!to) return;
    // a tab node says `type: "tab"`, which `tab.add` does not take: the rest is its init
    const { type: _type, ...init } = tab;
    model.run("tab.add", { ...init, to, index, select: true });
}

/** The words of a toast for one event, or nothing for a command the example does not announce. */
function describe(
    model: Model<Types>,
    event: CommandEvent<Types>,
): Omit<Toast, "id"> | undefined {
    if (event.command === "tabset.maximize") {
        return field(event.payload, "value") === true
            ? { tone: "info", title: "Maximized a tabset" }
            : { tone: "info", title: "Restored the layout" };
    }
    const tabId = field(event.result, "tabId");
    if (typeof tabId !== "string") return undefined;
    // a closed tab is only in the state before the event, an added one only in the state after it
    const before = placeOf(event.before.root, tabId);
    const after = placeOf(event.after.root, tabId);
    const name = (before ?? after)?.tab.label ?? "a tab";
    switch (event.command) {
        case "tab.close":
            return {
                tone: "danger",
                title: `Closed ${name}`,
                action: before && {
                    label: "Undo",
                    run: () => reopen(model, before),
                },
            };
        case "tab.move": {
            const location = field(event.payload, "location");
            return {
                tone: "info",
                title: `Moved ${name}`,
                detail:
                    typeof location === "string" && location !== "center"
                        ? `Docked ${location}`
                        : before?.tabsetId === after?.tabsetId
                          ? "Reordered in its tabset"
                          : "Into another tabset",
            };
        }
        case "tab.add":
            return { tone: "success", title: `Added ${name}` };
        case "tab.select":
            return { tone: "neutral", title: `Showing ${name}` };
        default:
            return undefined;
    }
}

export default function EventToasts() {
    const [model] = useState(() => createModel<Types>(json));
    const { toasts, show, dismiss } = useToasts();
    const [muted, setMuted] = useState<ReadonlySet<CommandName>>(
        () => new Set(["tab.select"]),
    );
    const [added, setAdded] = useState(0);

    useEffect(
        () =>
            model.subscribe((event) => {
                // a splitter drag commits many transient steps: none of them is news
                if (event.transient || muted.has(event.command)) return;
                const toast = describe(model, event);
                if (toast) show(toast);
            }),
        [model, muted, show],
    );

    const addChart = () => {
        const tabset = model.get("default-tabset");
        if (!tabset) return;
        setAdded((count) => count + 1);
        model.run("tab.add", {
            component: "chart",
            label: `Chart ${added + 1}`,
            data: { kind: "line" },
            to: tabset.id,
            select: true,
        });
    };

    return (
        <>
            <div className={styles.toolbar}>
                <fieldset aria-label="Toast on" className={styles.kinds}>
                    {KINDS.map(({ command, label }) => (
                        <button
                            key={command}
                            type="button"
                            aria-pressed={!muted.has(command)}
                            className={styles.kind}
                            onClick={() =>
                                setMuted((current) => {
                                    const next = new Set(current);
                                    if (!next.delete(command))
                                        next.add(command);
                                    return next;
                                })
                            }
                        >
                            {label}
                        </button>
                    ))}
                </fieldset>
                <button
                    type="button"
                    className={styles.button}
                    onClick={addChart}
                >
                    <Plus aria-hidden="true" className={styles.icon} />
                    Add a chart
                </button>
            </div>
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
                                {tab.component === "chart" ? (
                                    <ChartPanel
                                        kind={tab.data.kind}
                                        seed={tab.label.length}
                                        title={tab.label}
                                    />
                                ) : (
                                    <KpiPanel
                                        label={tab.label}
                                        seed={tab.data.seed}
                                    />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
                <Toaster toasts={toasts} dismiss={dismiss} />
            </div>
        </>
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

/** A tabset: closable tabs, and a button that maximizes or restores it. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const maximized = model.is("tabset-maximized", { tabsetId: node.id });
    const value = !maximized;
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => <ClosableTab tab={tab} />}
                </Dockable.TabList>
                {model.can("tabset.maximize", { tabsetId: node.id, value }) ? (
                    <button
                        type="button"
                        aria-label={maximized ? "Restore" : "Maximize"}
                        className={styles.stripButton}
                        onClick={() =>
                            model.run("tabset.maximize", {
                                tabsetId: node.id,
                                value,
                            })
                        }
                    >
                        {maximized ? (
                            <Minimize2
                                aria-hidden="true"
                                className={styles.icon}
                            />
                        ) : (
                            <Maximize2
                                aria-hidden="true"
                                className={styles.icon}
                            />
                        )}
                    </button>
                ) : null}
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A tab with a close button. */
function ClosableTab({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    return (
        <Dockable.Tab node={tab} className={styles.tab}>
            <span className={styles.tabName}>{tab.label}</span>
            <button
                type="button"
                // the keyboard closes with Ctrl+Delete on the tab itself
                tabIndex={-1}
                aria-label={`Close ${tab.label}`}
                className={styles.closeButton}
                // keep the press from selecting the tab or starting a drag
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    model.run("tab.close", { tabId: tab.id });
                }}
            >
                <X aria-hidden="true" className={styles.closeIcon} />
            </button>
            <span aria-hidden="true" className={styles.tabMarker} />
        </Dockable.Tab>
    );
}

/** The bar between two children of a row. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}
