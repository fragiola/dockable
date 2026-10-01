"use client";

import {
    type BatchEntry,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { MonitorDown, MonitorUp, Undo2 } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";

// A control room: each tabset can go to its own window ("screen"), tabs can be dragged between
// the windows and the main layout, and "Bring everything back" docks every window's tabs into the
// main layout. Dockable.PopoutTrigger with target="tabset" does the sending; a batch of
// `window.close` commands the bringing back. `popoutMirrorRoot` mirrors the page's theme into
// each window.

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

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function MultiMonitor() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("");

    // every window closes, and its tabs dock back into the main layout: one batch, one step
    const bringBack = () => {
        const windows = model.state.windows;
        const panels = windows.flatMap((layout) =>
            model.get("tabs-by-layout-id", { layoutId: layout.id }),
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
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <p className="text-sm text-palette-accent/85">
                    Send a tabset to another screen with its monitor button,
                    then drag panels between the windows.
                </p>
                <button
                    type="button"
                    className={cn(
                        "ms-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                        "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
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
            {/* The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter
                around the layout goes on a wrapper: padding on the root would not move the row. */}
            <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                <Dockable.Root
                    model={model}
                    popoutURL={popoutURL}
                    // copies <html> and <body>'s attributes (light/dark, the example theme) into
                    // each popout window, and keeps them in sync
                    popoutMirrorRoot
                    className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
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
                            <Dockable.Panel
                                node={tab}
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                <Content tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <DropIndicator />
                    {/* Each window's layout: its own root element in the window's document, with
                        the same recursion as the main layout. */}
                    <Dockable.Popout<Types> className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast">
                        {() => (
                            <>
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                {/* a window shows its own outline during a drag into it */}
                                <DropIndicator />
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

/** A tabset: its strip of tabs and its screen buttons on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label={node.data?.name || "Tabs"}
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={cn(
                                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                            )}
                        >
                            <span className="truncate">{tab.data.name}</span>
                            {/* the active tabset's marker: `in-data-active:` reads the enclosing
                                TabSet's data-active, `group-data-selected/tab:` this tab's */}
                            <span
                                aria-hidden="true"
                                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className="flex items-center gap-0.5 pe-1">
                    <ScreenButton tabset={node} />
                    <BackButton />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** Sends the whole tabset to a window; in a window, brings it back. */
function ScreenButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const name = tabset.data?.name ?? "panel";
    return (
        <Dockable.PopoutTrigger
            target="tabset"
            aria-label={`Move ${name} to another screen`}
            data-testid="move-tabset"
            // in a window, the trigger docks back (`data-mode="dock"`): BackButton does that
            className={cn(
                "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                "disabled:pointer-events-none disabled:opacity-40 data-[mode=dock]:hidden",
            )}
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
            className={cn(
                "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                "disabled:pointer-events-none disabled:opacity-40 data-[mode=popout]:hidden",
            )}
        >
            <MonitorDown aria-hidden className="size-3.5" />
        </Dockable.PopoutTrigger>
    );
}

/**
 * Where a dragged tab would land, in the main layout or in a window. Panels are portalled into
 * the root after it, so it needs a stacking order to paint above them.
 */
function DropIndicator() {
    return (
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
