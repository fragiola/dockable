"use client";

import {
    createModel,
    type LayoutJson,
    type TabNode,
    type TabOf,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/atoms/badge";
import { cn } from "#/lib/cn";
import { PanelBody } from "../_kit/card";
import { TabParts, withTabElement } from "../_kit/custom-tabs";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// The tab follows its content. The content writes what the tab needs to know into the tab's
// `data` (with a command, so it is in the model, the JSON and the undo history); the tab reads
// `tab.data`, typed by its component, and exposes it as its own `data-*` attributes for the styles.

type Status = "healthy" | "degraded" | "down";

interface MonitorData {
    name: string;
    status: Status;
    incidents: number;
}

interface DocumentData {
    name: string;
    dirty: boolean;
}

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { monitor: MonitorData; document: DocumentData } };

const STATUS = {
    healthy: { palette: "palette-green", Icon: CircleCheck, text: "Healthy" },
    degraded: {
        palette: "palette-orange",
        Icon: TriangleAlert,
        text: "Degraded",
    },
    down: { palette: "palette-danger", Icon: CircleX, text: "Down" },
} as const;

const monitor = (name: string, status: Status, incidents = 0) => ({
    component: "monitor" as const,
    data: { name, status, incidents },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    monitor("API", "healthy"),
                    monitor("Database", "degraded", 2),
                    monitor("Queue", "healthy"),
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "document",
                        data: { name: "README.md", dirty: false },
                    },
                    {
                        component: "document",
                        data: { name: "notes.txt", dirty: false },
                    },
                ],
            },
        ],
    },
};

/** What a tab shows about its content, read from its typed data. */
function tabState(tab: TabOf<Types>) {
    switch (tab.component) {
        case "monitor":
            return {
                status: tab.data.status,
                incidents: tab.data.incidents,
                dirty: false,
            };
        case "document":
            return { status: undefined, incidents: 0, dirty: tab.data.dirty };
    }
}

/** The tab: it only reads the data and turns it into `data-*` and a palette. */
function StatusTab({ tab }: { tab: TabOf<Types> }) {
    const { status: current, incidents, dirty } = tabState(tab);
    const status = current ? STATUS[current] : undefined;
    return (
        <Dockable.Tab
            node={tab}
            data-kit-tab=""
            data-status={current}
            data-modified={dirty ? "" : undefined}
            className={cn(
                styles.tab,
                status?.palette,
                // the status palette colours the label, and the selected tab is a solid chip
                "data-status:text-palette-accent data-status:data-selected:bg-palette-base data-status:data-selected:text-palette-contrast",
            )}
        >
            {status ? (
                <status.Icon aria-hidden className="size-3.5 shrink-0" />
            ) : null}
            <TabParts tab={tab} />
            {incidents ? (
                <Badge
                    variant="solid"
                    aria-label={`${incidents} incidents`}
                    // inverted on the selected (solid) tab
                    className="px-1.5 py-0 tabular-nums in-data-selected:bg-palette-contrast in-data-selected:text-palette-base"
                >
                    {incidents}
                </Badge>
            ) : null}
            {dirty ? (
                // the "modified" dot; its text is for screen readers only
                <span className="size-2 shrink-0 rounded-full bg-current">
                    <span className="sr-only">Modified</span>
                </span>
            ) : null}
        </Dockable.Tab>
    );
}

/** Content that reports its status to its tab. */
function Monitor({ tab }: { tab: TabNode<"monitor", MonitorData> }) {
    const { run } = useDockable<Types>();
    const data = tab.data;
    const report = (status: Status) => {
        if (status === data.status) {
            return;
        }
        // `tab.update` replaces the whole data, checked against the monitor's type
        run("tab.update", {
            tab: tab.id,
            component: "monitor",
            data: {
                ...data,
                status,
                incidents: data.incidents + (status === "healthy" ? 0 : 1),
            },
        });
    };
    return (
        <PanelBody title={`${data.name} service`}>
            <p className="text-palette-accent/85">
                Set the service's health. The panel writes it into the tab's
                data with a command; the tab reads it back.
            </p>
            <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Status</legend>
                {(Object.keys(STATUS) as Status[]).map((status) => (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={data.status === status}
                        // the current status is a solid button in its palette
                        className={cn(
                            styles.button,
                            data.status === status && STATUS[status].palette,
                        )}
                        onClick={() => report(status)}
                    >
                        {STATUS[status].text}
                    </button>
                ))}
            </fieldset>
            <p className="text-sm text-palette-accent/85">
                {`Incidents so far: ${data.incidents}`}
            </p>
        </PanelBody>
    );
}

/** An editor that marks its tab as modified while its text differs from the saved one. */
function Editor({ tab }: { tab: TabNode<"document", DocumentData> }) {
    const { run } = useDockable<Types>();
    const [saved, setSaved] = useState(`# ${tab.data.name}\n`);
    const [text, setText] = useState(saved);
    const setDirty = (dirty: boolean) => {
        // only run the command when the flag changes, not on every keystroke
        if (tab.data.dirty !== dirty) {
            run("tab.update", {
                tab: tab.id,
                component: "document",
                data: { ...tab.data, dirty },
            });
        }
    };
    return (
        <div className="flex h-full flex-col gap-2 p-3">
            <textarea
                aria-label={`${tab.data.name} text`}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    setDirty(event.target.value !== saved);
                }}
                className="min-h-24 flex-1 resize-none rounded-md border border-palette-line bg-palette-soft p-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-palette-ring"
            />
            <div>
                <button
                    type="button"
                    className={cn("palette-blue", styles.solidButton)}
                    onClick={() => {
                        setSaved(text);
                        setDirty(false);
                    }}
                >
                    Save
                </button>
            </div>
        </div>
    );
}

const renderTabSet = withTabElement<Types>((tab) => <StatusTab tab={tab} />);

export default function ContentAwareTabs() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderTabSet={renderTabSet}
            // `tab.data` narrows on `tab.component`: each panel gets its own typed tab
            renderContent={(tab) =>
                tab.component === "monitor" ? (
                    <Monitor tab={tab} />
                ) : (
                    <Editor tab={tab} />
                )
            }
        />
    );
}
