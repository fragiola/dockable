"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/atoms/badge";
import { cn } from "#/lib/cn";
import { PanelBody } from "../_kit/card";

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

export default function ContentAwareTabs() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
            >
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            // panels sit in a layer above the tabsets, whose overflow cannot clip
                            // them: the panel repeats the tabset's inner radius on its corners
                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                        >
                            {/* `tab.data` narrows on `tab.component`: each panel gets its own
                                typed tab */}
                            {tab.component === "monitor" ? (
                                <Monitor tab={tab} />
                            ) : (
                                <Editor tab={tab} />
                            )}
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Panels are portalled into the root after the indicator: it needs a stacking
                    order to paint above them. */}
                <Dockable.DropIndicator
                    className={(state) =>
                        cn(
                            "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
                            state.kind === "edge"
                                ? "palette-orange bg-palette-base/25"
                                : "palette-blue bg-palette-base/20",
                        )
                    }
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

/** A tabset: a card with the strip of status tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => <StatusTab tab={tab} />}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

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
            data-status={current}
            data-modified={dirty ? "" : undefined}
            className={cn(
                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                status?.palette,
                // the status palette colours the label, and the selected tab is a solid chip
                "data-status:text-palette-accent data-status:data-selected:bg-palette-base data-status:data-selected:text-palette-contrast",
            )}
        >
            {status ? (
                <status.Icon aria-hidden className="size-3.5 shrink-0" />
            ) : null}
            <span className="truncate">{tab.data.name}</span>
            {/* the active tabset's marker: `in-data-active:` reads the enclosing TabSet's
                data-active, `group-data-selected/tab:` this tab's */}
            <span
                aria-hidden="true"
                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
            />
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
    const { model } = useDockable<Types>();
    const data = tab.data;
    const report = (status: Status) => {
        if (status === data.status) {
            return;
        }
        // `tab.update` replaces the whole data, checked against the monitor's type
        model.run("tab.update", {
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
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
                            "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                            "disabled:pointer-events-none disabled:opacity-50",
                            // the current status is a solid button in its palette
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
    const { model } = useDockable<Types>();
    const [saved, setSaved] = useState(`# ${tab.data.name}\n`);
    const [text, setText] = useState(saved);
    const setDirty = (dirty: boolean) => {
        // only run the command when the flag changes, not on every keystroke
        if (tab.data.dirty !== dirty) {
            model.run("tab.update", {
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
                    className={cn(
                        "palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
                        "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
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

/**
 * The bar between two children of a row: `--dk-splitter-size` thick (the engine measures it), with
 * a wider grab area (`::after`) and a grip for the themes that show one (`--dk-grip`).
 */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                // side by side: a vertical bar
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                // stacked: a horizontal bar
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}
