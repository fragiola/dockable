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
import { MonitorDown, MonitorUp, Undo2 } from "lucide-react";
import { useState } from "react";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

// A control room: each tabset can go to its own window ("screen"), tabs can be dragged between
// the windows and the main layout, and "Bring everything back" docks every window's tabs into the
// main layout. Dockable.PopoutTrigger with target="tabset" does the sending; a batch of
// `window.close` commands the bringing back. `popoutMirrorRoot` mirrors the page's theme into
// each window.

type Types = {
    tabs: {
        requests: undefined;
        latency: undefined;
        orders: undefined;
        refunds: undefined;
        events: undefined;
    };
    tabset: { name: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                data: { name: "Traffic" },
                weight: 40,
                children: [
                    { component: "requests", label: "Requests" },
                    { component: "latency", label: "Latency" },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        data: { name: "Orders" },
                        children: [
                            { component: "orders", label: "Orders" },
                            { component: "refunds", label: "Refunds" },
                        ],
                    },
                    {
                        type: "tabset",
                        data: { name: "Events" },
                        children: [{ component: "events", label: "Events" }],
                    },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function MultiMonitor() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("");

    // every window closes, and its tabs dock back into the main layout: one batch, one step
    const bringBack = () => {
        const windows = model.get("windows");
        const panels = windows.flatMap((layout) =>
            model.get("tabs", { layoutId: layout.id }),
        );
        const commands = windows.map(
            (layout): BatchEntry<Types> => ({
                command: "window.close",
                payload: { windowId: layout.id },
            }),
        );
        if (commands.length > 0) {
            model.run("batch", { commands });
        }
        setStatus(
            panels.length
                ? `Brought back ${panels.length} panel(s)`
                : "Nothing is on another screen",
        );
    };

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <p className={styles.hint}>
                    Send a tabset to another screen with its monitor button,
                    then drag panels between the windows.
                </p>
                <button
                    type="button"
                    className={styles.button}
                    onClick={bringBack}
                >
                    <Undo2 aria-hidden className={styles.buttonIcon} />
                    Bring everything back
                </button>
                <span
                    role="status"
                    data-testid="status"
                    className={styles.status}
                >
                    {status}
                </span>
            </div>
            <div className={styles.frame}>
                <Dockable.Root
                    model={model}
                    popoutURL={popoutURL}
                    // copies <html> and <body>'s attributes (light/dark, the example theme) into
                    // each popout window, and keeps them in sync
                    popoutMirrorRoot
                    className={styles.root}
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    {/* Every tab's content, in the main layout or in a window: the engine moves
                        a panel's element into the window its tab is in. */}
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <Content tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                    {/* Each window's layout: its own root element in the window's document, with
                        the same recursion as the main layout. */}
                    <Dockable.Popout<Types> className={styles.popout}>
                        {() => (
                            <>
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.DropIndicator
                                    className={styles.dropIndicator}
                                />
                            </>
                        )}
                    </Dockable.Popout>
                </Dockable.Root>
            </div>
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "requests":
            return <ChartPanel kind="area" seed={11} />;
        case "latency":
            return <ChartPanel kind="line" seed={23} />;
        case "orders":
        case "refunds":
            return <TablePanel />;
        case "events":
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
    return <TabSet node={node} />;
}

/** A tabset: its strip of tabs and its screen buttons on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label={node.data?.name || "Tabs"}
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.tabsetActions}>
                    <ScreenButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * In the main layout, sends the whole tabset to a window; in a window, brings its selected tab
 * back to the main screen.
 */
function ScreenButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const name = tabset.data?.name ?? "panel";
    return model.is("node-in-window", { nodeId: tabset.id }) ? (
        <Dockable.PopoutTrigger
            aria-label="Back to the main screen"
            data-testid="back"
            className={styles.screenButton}
        >
            <MonitorDown aria-hidden className={styles.actionIcon} />
        </Dockable.PopoutTrigger>
    ) : (
        <Dockable.PopoutTrigger
            target="tabset"
            aria-label={`Move ${name} to another screen`}
            data-testid="move-tabset"
            className={styles.screenButton}
        >
            <MonitorUp aria-hidden className={styles.actionIcon} />
        </Dockable.PopoutTrigger>
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
