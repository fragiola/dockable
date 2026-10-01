"use client";

import {
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
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "#/lib/cn";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";

// Maximize a tabset three ways: its header button, a double-click on the empty part of its strip,
// and Escape to restore. The styles read `data-maximized` (on the tabset and on the root); the
// splitters hide themselves while a tabset is maximized.

// What the layout holds: three components, each named in its data.
type Types = {
    tabs: {
        chart: { name: string };
        bars: { name: string };
        table: { name: string };
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
                    { component: "chart", data: { name: "Revenue" } },
                    { component: "table", data: { name: "Orders" } },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "bars", data: { name: "Signups" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "table", data: { name: "Latest" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function Maximize() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter around
        // the layout goes on a wrapper: padding on the root would not move the row.
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                // the root has data-maximized while a tabset is maximized
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast data-maximized:bg-palette-soft"
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
                            <Content tab={tab} />
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
                <RestoreOnEscape />
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

/**
 * A tabset: the strip and its maximize button on top, the measured content area below. The
 * maximized tabset is outlined and its header highlighted; a double-click on the header (not on
 * a tab or a button) toggles.
 */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { model, layoutId } = useDockable<Types>();
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line) data-maximized:ring-2 data-maximized:ring-palette-ring data-maximized:ring-inset"
        >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a mouse shortcut; the button is the accessible way */}
            <div
                className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line in-data-maximized:bg-palette-soft"
                onDoubleClick={(event) => {
                    const target = event.target as Element;
                    if (
                        !target.closest('[role="tab"], button') &&
                        canMaximize(model, node)
                    ) {
                        model.run("tabset.maximize", {
                            tabset: node.id,
                            value:
                                model.get("maximized-tabset", {
                                    layout: layoutId,
                                })?.id !== node.id,
                        });
                    }
                }}
            >
                <Dockable.TabList<Types>
                    aria-label="Tabs"
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
                    <MaximizeButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A tab's content: `tab.data` and the component narrow together. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return <ChartPanel kind="area" seed={3} />;
        case "bars":
            return <ChartPanel kind="bar" seed={19} />;
        case "table":
            return <TablePanel />;
    }
}

/** Whether the tabset may be maximized: the model answers without running the command. */
function canMaximize(model: Model<Types>, tabset: TabsetNode<Types>) {
    return model.can("tabset.maximize", { tabset: tabset.id, value: true });
}

function MaximizeButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, layoutId } = useDockable<Types>();
    const maximized =
        model.get("maximized-tabset", { layout: layoutId })?.id === tabset.id;
    if (!canMaximize(model, tabset)) {
        return null;
    }
    return (
        <button
            type="button"
            aria-label={maximized ? "Restore" : "Maximize"}
            aria-pressed={maximized}
            className={cn(
                "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                "focus-visible:ring-2 focus-visible:ring-palette-ring",
                "disabled:pointer-events-none disabled:opacity-40",
            )}
            onClick={() =>
                model.run("tabset.maximize", {
                    tabset: tabset.id,
                    value: !maximized,
                })
            }
        >
            {maximized ? (
                <Minimize2 aria-hidden className="size-3.5" />
            ) : (
                <Maximize2 aria-hidden className="size-3.5" />
            )}
        </button>
    );
}

/** Escape restores the maximized tabset, from anywhere in the page. */
function RestoreOnEscape() {
    const { engine, model, layoutId } = useDockable<Types>();
    useEffect(() => {
        const doc = engine.get("owner-document");
        if (!doc) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            const maximized = model.get("maximized-tabset", {
                layout: layoutId,
            });
            if (
                event.key === "Escape" &&
                !event.defaultPrevented &&
                maximized
            ) {
                model.run("tabset.maximize", {
                    tabset: maximized.id,
                    value: false,
                });
            }
        };
        doc.addEventListener("keydown", onKeyDown);
        return () => doc.removeEventListener("keydown", onKeyDown);
    }, [engine, model, layoutId]);
    return null;
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
