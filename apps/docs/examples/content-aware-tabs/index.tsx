"use client";

import {
    Actions,
    type IJsonModel,
    Model,
    type TabNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/cn";
import { PanelBody } from "../_kit/card";
import { TabParts, withTabElement } from "../_kit/custom-tabs";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// The tab follows its content. The content writes what the tab needs to know into the tab's
// `config` (through an action, so it is in the model, the JSON and the undo history); the tab
// reads `tab.getConfig()` and exposes it as its own `data-*` attributes for the styles.

type Status = "healthy" | "degraded" | "down";

interface MonitorConfig {
    status: Status;
    incidents: number;
}

interface DocumentConfig {
    dirty: boolean;
}

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
    type: "tab",
    name,
    component: "monitor",
    config: { status, incidents } satisfies MonitorConfig,
});

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
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
                        type: "tab",
                        name: "README.md",
                        component: "document",
                        config: { dirty: false } satisfies DocumentConfig,
                    },
                    {
                        type: "tab",
                        name: "notes.txt",
                        component: "document",
                        config: { dirty: false } satisfies DocumentConfig,
                    },
                ],
            },
        ],
    },
};

/** The tab: it only reads the config and turns it into `data-*` and a palette. */
function StatusTab({ tab }: { tab: TabNode }) {
    const config = tab.getConfig() as
        | Partial<MonitorConfig & DocumentConfig>
        | undefined;
    const status = config?.status ? STATUS[config.status] : undefined;
    return (
        <Dockable.Tab
            node={tab}
            data-kit-tab=""
            data-status={config?.status}
            data-modified={config?.dirty ? "" : undefined}
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
            {config?.incidents ? (
                <Badge
                    variant="solid"
                    aria-label={`${config.incidents} incidents`}
                    // inverted on the selected (solid) tab
                    className="px-1.5 py-0 tabular-nums in-data-selected:bg-palette-contrast in-data-selected:text-palette-base"
                >
                    {config.incidents}
                </Badge>
            ) : null}
            {config?.dirty ? (
                // the "modified" dot; its text is for screen readers only
                <span className="size-2 shrink-0 rounded-full bg-current">
                    <span className="sr-only">Modified</span>
                </span>
            ) : null}
        </Dockable.Tab>
    );
}

/** Content that reports its status to its tab. */
function Monitor({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    const config = tab.getConfig() as MonitorConfig;
    const report = (status: Status) => {
        if (status === config.status) {
            return;
        }
        engine.doAction(
            Actions.updateNodeAttributes(tab.getId(), {
                config: {
                    status,
                    incidents:
                        config.incidents + (status === "healthy" ? 0 : 1),
                } satisfies MonitorConfig,
            }),
        );
    };
    return (
        <PanelBody title={`${tab.getName()} service`}>
            <p className="text-palette-accent/85">
                Set the service's health. The panel writes it into the tab's
                config with an action; the tab reads it back.
            </p>
            <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Status</legend>
                {(Object.keys(STATUS) as Status[]).map((status) => (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={config.status === status}
                        // the current status is a solid button in its palette
                        className={cn(
                            styles.button,
                            config.status === status && STATUS[status].palette,
                        )}
                        onClick={() => report(status)}
                    >
                        {STATUS[status].text}
                    </button>
                ))}
            </fieldset>
            <p className="text-sm text-palette-accent/85">
                {`Incidents so far: ${config.incidents}`}
            </p>
        </PanelBody>
    );
}

/** An editor that marks its tab as modified while its text differs from the saved one. */
function Editor({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    const [saved, setSaved] = useState(`# ${tab.getName()}\n`);
    const [text, setText] = useState(saved);
    const setDirty = (dirty: boolean) => {
        // only dispatch when the flag changes, not on every keystroke
        if ((tab.getConfig() as DocumentConfig).dirty !== dirty) {
            engine.doAction(
                Actions.updateNodeAttributes(tab.getId(), {
                    config: { dirty } satisfies DocumentConfig,
                }),
            );
        }
    };
    return (
        <div className="flex h-full flex-col gap-2 p-3">
            <textarea
                aria-label={`${tab.getName()} text`}
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

const renderTabSet = withTabElement((tab) => <StatusTab tab={tab} />);

export default function ContentAwareTabs() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderTabSet={renderTabSet}
            renderContent={(tab) =>
                tab.getComponent() === "monitor" ? (
                    <Monitor tab={tab} />
                ) : (
                    <Editor tab={tab} />
                )
            }
        />
    );
}
