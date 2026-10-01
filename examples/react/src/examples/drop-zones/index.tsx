"use client";

import {
    createModel,
    type DragSubject,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import {
    ExternalLink,
    type LucideIcon,
    PanelRight,
    Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// Drop zones: elements outside the layout that take a dragged tab. While a drag the zone takes is
// in progress it has `data-drop-active`; while the pointer is over it, `data-drop-over` (and the
// layout hides its outline). A drop calls `onDrop` with what is dragged: nothing moves by itself,
// the zone runs the command it stands for on the model (so its middleware sees it).

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Inbox" } },
                    { component: "card", data: { name: "Drafts" } },
                    // cannot be closed: the trash does not take it
                    {
                        component: "card",
                        data: { name: "Pinned note" },
                        enableClose: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Calendar" } },
                    { component: "card", data: { name: "Contacts" } },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`): the Pop out
// zone opens a tab in a window.
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function DropZones() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("Drag a tab onto a zone below.");

    // the zones live outside Dockable.Root: they run commands on the model itself
    const report = (ok: boolean, describe: string) => {
        if (ok) setStatus(describe);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter
                around the layout goes on a wrapper: padding on the root would not move the row. */}
            <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                <Dockable.Root
                    model={model}
                    popoutURL={popoutURL}
                    // copies <html> and <body>'s attributes (light/dark, the example theme) into
                    // each popout window, kept in sync
                    popoutMirrorRoot
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
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                <Card name={tab.data.name} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Panels are portalled into the root after the indicator: it needs a
                        stacking order to paint above them. */}
                    <DropIndicator />
                    {/* a popped-out tab's window: its own layout, and its own outline */}
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
                                <DropIndicator />
                            </>
                        )}
                    </Dockable.Popout>
                </Dockable.Root>
            </div>
            <div className="palette-surface flex flex-wrap items-stretch gap-2 border-t border-palette-line bg-palette-base p-2">
                <Zone
                    model={model}
                    id="close"
                    icon={Trash2}
                    label="Close"
                    tone="palette-danger"
                    // only tabs that may be closed
                    accepts={(tab) => model.can("tab.close", { tabId: tab.id })}
                    onDrop={(tab) =>
                        report(
                            model.run("tab.close", { tabId: tab.id }).ok,
                            `Closed ${tab.data.name}`,
                        )
                    }
                />
                <Zone
                    model={model}
                    id="right"
                    icon={PanelRight}
                    label="Open to the right"
                    tone="palette-blue"
                    accepts={() => true}
                    onDrop={(tab) => {
                        const root = model.get("root-row-by-layout-id");
                        if (!root) return;
                        // the right edge of the root row: a new tabset on the right of the layout
                        report(
                            model.run("tab.move", {
                                tabId: tab.id,
                                to: root.id,
                                location: "right",
                            }).ok,
                            `Moved ${tab.data.name} to the right`,
                        );
                    }}
                />
                <Zone
                    model={model}
                    id="popout"
                    icon={ExternalLink}
                    label="Pop out"
                    tone="palette-green"
                    accepts={(tab) =>
                        model.can("tab.popout", { tabId: tab.id })
                    }
                    onDrop={(tab) =>
                        report(
                            model.run("tab.popout", { tabId: tab.id }).ok,
                            `Popped out ${tab.data.name}`,
                        )
                    }
                />
                <p
                    role="status"
                    data-testid="status"
                    className="basis-full text-center text-xs text-palette-accent/85"
                >
                    {status}
                </p>
            </div>
        </div>
    );
}

/** The dragged tab of the layout, or undefined for a tabset or a new tab. */
function draggedTab(drag: DragSubject<Types>): TabOf<Types> | undefined {
    return drag.kind === "tab" ? drag.tab : undefined;
}

function Zone({
    model,
    icon: Icon,
    label,
    accepts,
    onDrop,
    tone,
    id,
}: {
    id: string;
    model: Model<Types>;
    icon: LucideIcon;
    label: ReactNode;
    accepts: (tab: TabOf<Types>) => boolean;
    onDrop: (tab: TabOf<Types>) => void;
    tone: string;
}) {
    return (
        <Dockable.DropZone
            model={model}
            // the zones take tabs only
            accepts={(drag) => {
                const tab = draggedTab(drag);
                return tab !== undefined && accepts(tab);
            }}
            onDrop={(drag) => {
                const tab = draggedTab(drag);
                if (tab) onDrop(tab);
            }}
            data-testid={`zone-${id}`}
            className={[
                tone,
                "flex flex-1 items-center justify-center gap-2 rounded-(--dk-radius) border-2 border-dashed border-palette-line p-3 text-sm",
                "text-palette-accent/85 transition-[opacity,background-color] duration-(--dk-motion)",
                // idle: faded; a drag it would take: armed; the pointer over it: filled
                "opacity-50 data-drop-active:border-palette-base data-drop-active:opacity-100",
                "data-drop-over:border-solid data-drop-over:bg-palette-base data-drop-over:text-palette-contrast",
            ].join(" ")}
        >
            <Icon aria-hidden className="size-4" />
            {label}
        </Dockable.DropZone>
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

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
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
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
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

/** Where a dragged tab would land: blue into a tabset, orange at an edge. */
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
