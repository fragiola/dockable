"use client";

import {
    type IJsonModel,
    LayoutEngine,
    Model,
    type TabNode,
    type TabSetNode,
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
// main layout. Dockable.PopoutTrigger with target="tabset" does the sending; engine.dockBack the
// bringing back. The kit mirrors the page's theme into each window (popoutMirrorRoot).

const panel = (name: string, component: string) => ({
    type: "tab" as const,
    name,
    component,
});

const json: IJsonModel = {
    global: { tabEnablePopout: true },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                name: "Traffic",
                weight: 40,
                children: [
                    panel("Requests", "requests"),
                    panel("Latency", "latency"),
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        name: "Orders",
                        children: [
                            panel("Orders", "orders"),
                            panel("Refunds", "refunds"),
                        ],
                    },
                    {
                        type: "tabset",
                        name: "Events",
                        children: [panel("Events", "events")],
                    },
                ],
            },
        ],
    },
};

function Content({ tab }: { tab: TabNode }) {
    switch (tab.getComponent()) {
        case "requests":
            return <ChartPanel kind="area" seed={11} />;
        case "latency":
            return <ChartPanel kind="line" seed={23} />;
        case "orders":
        case "refunds":
            return <TablePanel />;
        default:
            return <LogPanel />;
    }
}

/** Sends the whole tabset to a window; in a window, brings it back. */
function ScreenButton({ tabset }: { tabset: TabSetNode }) {
    const name = tabset.getName() ?? "panel";
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
    const [model] = useState(() => Model.fromJson(json));
    const [status, setStatus] = useState("");

    // every tab of every window, back into the main layout
    const bringBack = () => {
        const engine = LayoutEngine.of(model);
        if (!engine) return;
        const windows: TabNode[] = [];
        for (const [layoutId] of model.getLayouts()) {
            if (layoutId === Model.MAIN_LAYOUT_ID) continue;
            model.visitLayoutNodes(layoutId, (node) => {
                if (node.getType() === "tab") windows.push(node as TabNode);
            });
        }
        for (const tab of windows) engine.dockBack(tab);
        setStatus(
            windows.length
                ? `Brought back ${windows.length} panel(s)`
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
