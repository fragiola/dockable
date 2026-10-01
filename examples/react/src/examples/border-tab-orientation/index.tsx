"use client";

import {
    type BorderNode,
    type ComponentOf,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type SplitterProps } from "@fragiola/dockable-react";
import {
    Bell,
    Bookmark,
    FileText,
    ListTree,
    type LucideIcon,
    Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// A side border's tabs read vertically here by default (writing-mode, and half a turn more on a
// left border that reads "up"; see `Border` below). Nothing in the package imposes it:
// Dockable.Border only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        outline: { name: string };
        search: { name: string };
        bookmarks: { name: string };
        notes: { name: string };
        alerts: { name: string };
        card: { name: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "left",
            selected: 0,
            children: [
                { component: "outline", data: { name: "Outline" } },
                { component: "search", data: { name: "Search" } },
                { component: "bookmarks", data: { name: "Bookmarks" } },
            ],
        },
        {
            location: "right",
            children: [
                { component: "notes", data: { name: "Notes" } },
                { component: "alerts", data: { name: "Alerts" } },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [{ component: "card", data: { name: "Document" } }],
            },
        ],
    },
};

// the side panels' icons, by component (the document tab has none)
const icons: { [K in ComponentOf<Types>]?: LucideIcon } = {
    outline: ListTree,
    search: Search,
    bookmarks: Bookmark,
    notes: FileText,
    alerts: Bell,
};

type Orientation = "vertical" | "horizontal";

export default function BorderTabOrientation() {
    const [model] = useState(() => createModel<Types>(json));
    const [orientation, setOrientation] = useState<Orientation>("vertical");
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <fieldset className="flex items-center gap-1">
                    <legend className="sr-only">Side border labels</legend>
                    {(["vertical", "horizontal"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`labels-${value}`}
                            aria-pressed={orientation === value}
                            className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                                "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                                "aria-pressed:bg-palette-soft",
                            )}
                            onClick={() => setOrientation(value)}
                        >
                            {value === "vertical"
                                ? "Vertical labels"
                                : "Horizontal labels"}
                        </button>
                    ))}
                </fieldset>
            </div>
            {/* The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter
                around the layout goes on a wrapper: padding on the root would not move the row. */}
            <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                <Dockable.Root
                    model={model}
                    className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                >
                    {/* The model's borders around the main layout: each one's strip, and the
                        area where its selected tab's panel opens. */}
                    <Dockable.Borders<Types>
                        renderBar={(border) => (
                            <Border node={border} orientation={orientation} />
                        )}
                        renderContent={(border) => (
                            <BorderContent node={border} />
                        )}
                    >
                        <Dockable.Row<Types>
                            renderSplitter={(props) => <Splitter {...props} />}
                        >
                            {renderNode}
                        </Dockable.Row>
                    </Dockable.Borders>
                    {/* Every tab's content, the borders' too, positioned by the engine. */}
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
                    {/* Where a dragged tab would land. Panels are portalled into the root after
                        it, so it needs a stacking order to paint above them. */}
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
 * A border's strip: `--dk-tab-height` thick, on the floor's colour, with a line on the layout's
 * side. `data-orientation` is the direction its tabs run, `data-location` the side it is on.
 * The orientation toggle changes only the classes below.
 */
function Border({
    node,
    orientation,
}: {
    node: BorderNode<Types>;
    orientation: Orientation;
}) {
    const upright = orientation === "horizontal";
    return (
        <Dockable.Border
            node={node}
            className={cn(
                "palette-surface shrink-0 bg-palette-base text-palette-contrast",
                // upright labels: a side strip grows to fit them
                upright
                    ? "data-[orientation=vertical]:w-auto"
                    : "data-[orientation=vertical]:w-(--dk-tab-height)",
                "data-[orientation=horizontal]:h-(--dk-tab-height)",
                "data-[location=left]:border-e data-[location=right]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
                "data-drop-target:bg-palette-soft",
            )}
        >
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                // a column in a side border
                className="flex min-h-0 min-w-0 flex-1 gap-(--dk-tab-gap) p-1 data-[orientation=vertical]:flex-col"
            >
                {(tab) => (
                    <Dockable.Tab
                        node={tab}
                        className={cn(
                            "flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-sm px-2 py-1",
                            "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                            "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                            "data-selected:bg-palette-soft data-selected:text-palette-contrast data-dragging:opacity-40",
                            upright
                                ? // upright labels, as wide as the strip
                                  "w-full"
                                : // vertical labels: turned with `writing-mode`, and a left border
                                  // that reads "up" (`data-tab-direction`) turns them half a turn
                                  // more; the tabs stay in order from the top
                                  [
                                      "in-data-[orientation=vertical]:[writing-mode:vertical-rl] in-data-[orientation=vertical]:px-1 in-data-[orientation=vertical]:py-2",
                                      "in-data-[tab-direction=up]:rotate-180",
                                  ],
                        )}
                    >
                        <Label tab={tab} />
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

function Label({ tab }: { tab: TabOf<Types> }) {
    const Icon = icons[tab.component];
    return (
        <>
            {Icon ? (
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            {tab.data.name}
        </>
    );
}

/** Where a border's panel opens, with a splitter on the layout's side of it to resize it. */
function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            renderSplitter={(border) => <Splitter node={border} />}
        />
    );
}

/**
 * The bar between two children of a row, or beside a border's panel: `--dk-splitter-size` thick
 * (the engine measures it), with a wider grab area (`::after`) and a grip for the themes that show
 * one (`--dk-grip`).
 */
function Splitter(props: SplitterProps<Types>) {
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
