"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { PanelBottom, PanelTop } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "Sheet 1" } },
                    { component: "card", data: { name: "Sheet 2" } },
                    { component: "card", data: { name: "Sheet 3" } },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "card", data: { name: "Console" } },
                    { component: "card", data: { name: "Watch" } },
                ],
            },
        ],
    },
};

type Position = "top" | "bottom";

export default function TabsAtBottom() {
    const [model] = useState(() => createModel<Types>(json));
    const [position, setPosition] = useState<Position>("bottom");
    const bottom = position === "bottom";

    /** A row's child: a tabset, or a nested row rendered by this same function. */
    const renderNode = (node: TabsetNode<Types> | RowNode<Types>) =>
        node.type === "row" ? (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        ) : (
            <TabSet node={node} position={position} />
        );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <span className="text-sm text-palette-accent/85">Tabs</span>
                {(["top", "bottom"] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={position === value}
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                            "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                            "aria-pressed:bg-palette-soft aria-pressed:font-medium",
                        )}
                        onClick={() => setPosition(value)}
                    >
                        {value === "top" ? (
                            <PanelTop aria-hidden className="size-4" />
                        ) : (
                            <PanelBottom aria-hidden className="size-4" />
                        )}
                        {value === "top" ? "Top" : "Bottom"}
                    </button>
                ))}
            </div>
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
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on the
                                // corners away from the strip
                                className={cn(
                                    "palette-raised overflow-auto bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast",
                                    bottom
                                        ? "rounded-t-[max(0px,calc(var(--dk-radius)-var(--dk-border)))]"
                                        : "rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))]",
                                )}
                            >
                                <Card name={tab.data.name} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Panels are portalled into the root after the indicator: it needs a
                        stacking order to paint above them. */}
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

/**
 * A tabset is a flex column (`Dockable.TabSet` sets `display: flex; flex-direction: column`),
 * and `Dockable.TabSetContent` takes the space left over. So the strip goes below the content
 * just by coming after it in the markup: the engine measures the content area wherever it is
 * and positions the panel over it.
 */
function TabSet({
    node,
    position,
}: {
    node: TabsetNode<Types>;
    position: Position;
}) {
    const bottom = position === "bottom";
    const strip = (
        <div
            className={cn(
                "flex min-h-(--dk-tab-height) items-stretch border-palette-line",
                // below the content, the strip's rule moves to its top edge
                bottom ? "border-t" : "border-b",
            )}
        >
            <Dockable.TabList<Types>
                aria-label="Tabs"
                // the start padding is load-bearing: a tab flush with the tabset's edge could not
                // take a drop before it (that edge is the tabset's side drop)
                className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
            >
                {(tab) => (
                    <Dockable.Tab
                        node={tab}
                        className={cn(
                            "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                            "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                            "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                            "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                            "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                            // below the content, the tabs hang from the strip's rule
                            bottom
                                ? "rounded-b-(--dk-tab-radius)"
                                : "rounded-t-(--dk-tab-radius)",
                        )}
                    >
                        <span className="truncate">{tab.data.name}</span>
                        {/* the active tabset's marker, on the edge that meets the content:
                            `in-data-active:` reads the enclosing TabSet's data-active */}
                        <span
                            aria-hidden="true"
                            className={cn(
                                "palette-blue pointer-events-none absolute inset-x-2 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]",
                                bottom ? "top-0" : "bottom-0",
                            )}
                        />
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </div>
    );
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            {bottom ? null : strip}
            <Dockable.TabSetContent />
            {bottom ? strip : null}
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
