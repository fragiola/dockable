"use client";

import {
    type BatchEntry,
    createModel,
    type LayoutJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { MonitorDown, MonitorUp, Undo2 } from "lucide-react";
import { useState } from "react";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// A control room: each tabset can go to its own window ("screen"), tabs can be dragged between
// the windows and the main layout, and "Bring everything back" docks every window's tabs into the
// main layout. Dockable.PopoutTrigger with target="tabset" does the sending; a batch of
// `window.close` commands the bringing back. The kit mirrors the page's theme into each window (popoutMirrorRoot).

// What the layout holds: five panel components (named in their data) and named tabsets.
type Types = {
    tabs: {
        requests: { name: string };
        latency: { name: string };
        orders: { name: string };
        refunds: { name: string };
        events: { name: string };
    };
    tabset: { name: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                data: { name: "Traffic" },
                weight: 40,
                children: [
                    { component: "requests", data: { name: "Requests" } },
                    { component: "latency", data: { name: "Latency" } },
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
                            { component: "orders", data: { name: "Orders" } },
                            { component: "refunds", data: { name: "Refunds" } },
                        ],
                    },
                    {
                        type: "tabset",
                        data: { name: "Events" },
                        children: [
                            { component: "events", data: { name: "Events" } },
                        ],
                    },
                ],
            },
        ],
    },
};

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

/** Sends the whole tabset to a window; in a window, brings it back. */
function ScreenButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const name = tabset.data?.name ?? "panel";
    return (
        <Dockable.PopoutTrigger
            target="tabset"
            aria-label={`Move ${name} to another screen`}
            data-testid="move-tabset"
            className={`${styles.iconButton} data-[mode=dock]:hidden`}
        >
            <MonitorUp aria-hidden className="size-3.5" />
        </Dockable.PopoutTrigger>
    );
}

/** In a window: the selected tab back to the main screen. */
function BackButton() {
    return (
        <Dockable.PopoutTrigger
            aria-label="Back to the main screen"
            data-testid="back"
            className={`${styles.iconButton} data-[mode=popout]:hidden`}
        >
            <MonitorDown aria-hidden className="size-3.5" />
        </Dockable.PopoutTrigger>
    );
}

export default function MultiMonitor() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("");

    // every window closes, and its tabs dock back into the main layout: one batch, one step
    const bringBack = () => {
        const windows = model.state.windows;
        const panels = windows.flatMap((layout) => model.tabs(layout.id));
        const commands = windows.map(
            (layout): BatchEntry<Types> => ({
                command: "window.close",
                payload: { window: layout.id },
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
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                <p className="text-sm text-palette-accent/85">
                    Send a tabset to another screen with its monitor button,
                    then drag panels between the windows.
                </p>
                <button
                    type="button"
                    className={`${styles.button} ms-auto`}
                    onClick={bringBack}
                >
                    <Undo2 aria-hidden className="size-4" />
                    Bring everything back
                </button>
                <span
                    role="status"
                    data-testid="status"
                    className="text-xs text-palette-accent/85"
                >
                    {status}
                </span>
            </div>
            <DockLayout
                model={model}
                renderActions={(tabset) => (
                    <>
                        <ScreenButton tabset={tabset} />
                        <BackButton />
                    </>
                )}
                renderContent={(tab) => <Content tab={tab} />}
            />
        </div>
    );
}
