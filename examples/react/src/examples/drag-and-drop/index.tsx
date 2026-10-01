"use client";

import {
    createModel,
    type DropLocation,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// Drag tabs between tabsets and to the layout's edges. The drop indicator is styled from its state:
// blue for a drop into a tabset (`kind: "rect"`), a dashed orange band for a drop at the layout's
// edge (`kind: "edge"`), an arrow for the side, and a transition as long as the root's
// `tabDragSpeed`. During a drag the edge indicators (Dockable.EdgeIndicator) mark the four bands
// where a drop docks to an edge.

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Drag me" } },
                    { component: "card", data: { name: "Or me" } },
                    { component: "card", data: { name: "Me too" } },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Inbox" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Outbox" } },
                        ],
                    },
                ],
            },
        ],
    },
};

const ARROWS: Partial<Record<DropLocation, typeof ArrowUp>> = {
    top: ArrowUp,
    bottom: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
};

const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["left", ArrowLeft],
    ["right", ArrowRight],
] as const;

export default function DragAndDrop() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter around
        // the layout goes on a wrapper: padding on the root would not move the row.
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                // how long the indicator may take to move to the next target (exposed as data)
                tabDragSpeed={0.2}
                // while a tab of this layout is dragged, the panels fade back
                className={cn(
                    "palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast",
                    "[&_[role=tabpanel]]:transition-opacity data-dragging:[&_[role=tabpanel]]:opacity-60",
                )}
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
                            <Card name={tab.data.name} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Panels are portalled into the root after the indicator: it needs a stacking
                    order to paint above them. */}
                <Dockable.DropIndicator
                    className={(state) =>
                        cn(
                            "z-20 grid place-items-center transition-[left,top,width,height] ease-out",
                            state.kind === "edge"
                                ? "palette-orange border-2 border-dashed border-palette-base bg-palette-base/30"
                                : "palette-blue rounded-(--dk-radius) border-2 border-palette-base bg-palette-base/15",
                        )
                    }
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                    // a render function gets the state too: an arrow for the side it docks to
                    render={(props, state) => {
                        const Arrow = ARROWS[state.location];
                        return (
                            <div {...props}>
                                {Arrow ? (
                                    <Arrow className="size-5 text-palette-base" />
                                ) : null}
                            </div>
                        );
                    }}
                />
                {/* the edge docking targets, shown during a drag (solid under the pointer) */}
                {EDGES.map(([edge, Arrow]) => (
                    <Dockable.EdgeIndicator
                        key={edge}
                        edge={edge}
                        className="palette-orange z-20 flex items-center justify-center rounded-sm bg-palette-base/40 text-palette-contrast transition-colors duration-(--dk-motion) data-drop-target:bg-palette-base"
                    >
                        <Arrow aria-hidden="true" className="size-3" />
                    </Dockable.EdgeIndicator>
                ))}
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
 * A tabset. The one the drag would drop into (or beside) has `data-drop-target` (and
 * `data-drop-location`), so it is styled from data alone: an inset ring.
 */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className={cn(
                "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
                "data-drop-target:ring-2 data-drop-target:ring-palette-ring data-drop-target:ring-inset",
            )}
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
