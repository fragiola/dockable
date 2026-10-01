"use client";

import {
    createModel,
    type LayoutJson,
    type ParentNode,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useModelState,
} from "@fragiola/dockable-react";
import { Palette } from "lucide-react";
import { useState } from "react";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";

// Fragiola palettes, scoped per tabset. A palette class sets six roles (base, soft, line,
// contrast, accent, ring) as CSS variables, and every `bg-palette-*`/`text-palette-*` inside
// reads them. Each tabset keeps its palette in its `data` (through the `tabset.configure` command,
// so it is saved with the layout); the tabset's element takes the class.
//
// A coloured palette's `base` is a strong fill, so the tabset uses the pairs its roles are made
// for: `soft` behind `accent` text, and the selected tab as a `base` chip with `contrast` text.

const PALETTES = [
    { value: "palette-blue", title: "Blue" },
    { value: "palette-orange", title: "Orange" },
    { value: "palette-green", title: "Green" },
    { value: "palette-purple", title: "Purple" },
    { value: "palette-surface", title: "Surface" },
    { value: "palette-raised", title: "Raised" },
] as const;

const DEFAULT_PALETTE = "palette-raised";

// What the layout holds: each tab component's data, and the tabsets' data (their palette).
type Types = {
    tabs: { chart: { name: string }; card: { name: string } };
    tabset: { palette: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                data: { palette: "palette-blue" },
                children: [
                    { component: "chart", data: { name: "Trend" } },
                    { component: "card", data: { name: "Notes" } },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        data: { palette: "palette-orange" },
                        children: [
                            { component: "card", data: { name: "Alerts" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Plain" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function ScopedPalettes() {
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
            </Dockable.Root>
        </div>
    );
}

/** A tabset's palette (a tab's parent may also be a border, which has none). */
function paletteOf(node: ParentNode<Types> | undefined): string {
    return (node?.type === "tabset" && node.data?.palette) || DEFAULT_PALETTE;
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

/** A tabset in its own palette: `soft` behind `accent` text, the selected tab a `base` chip. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className={cn(
                "rounded-(--dk-radius) border-(length:--dk-border) border-palette-line shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
                // the palette chosen in the menu, in place of the layout's palette-raised
                paletteOf(node),
                "bg-palette-soft text-palette-accent",
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
                                // the selected tab is a solid chip in the tabset's palette
                                "data-selected:bg-palette-base data-selected:text-palette-contrast data-dragging:opacity-40",
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
                    <PaletteMenu tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The tabset's palette picker: a Fragiola DropdownMenu with a radio group. */
function PaletteMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label="Tabset palette"
                className={cn(
                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
            >
                <Palette aria-hidden className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Group>
                    <DropdownMenu.Label>Palette</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup
                        value={paletteOf(tabset)}
                        onValueChange={(palette) =>
                            model.run("tabset.configure", {
                                tabsetId: tabset.id,
                                data: { ...tabset.data, palette },
                            })
                        }
                    >
                        {PALETTES.map((palette) => (
                            <DropdownMenu.RadioItem
                                key={palette.value}
                                value={palette.value}
                                closeOnClick
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        palette.value,
                                        "size-3 rounded-full border border-palette-line bg-palette-base",
                                    )}
                                />
                                {palette.title}
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Group>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}

/**
 * The panel's content in its tabset's palette. Panels live in a layer outside their tabset
 * (gap 2), so they cannot inherit its palette: the content repeats it, read from the model. (It
 * goes on the content rather than on the `Dockable.Panel`: the panel keeps `palette-raised`, which
 * an added `palette-surface` cannot override, since the surface rules come first in the
 * stylesheet.)
 */
function Content({ tab }: { tab: TabOf<Types> }) {
    const palette = useModelState<Types, string>((_, model) =>
        paletteOf(model.get("node-parent-by-id", { nodeId: tab.id })),
    );
    return (
        <div
            data-palette={palette}
            className={cn(
                palette,
                tab.component === "chart" ? "h-full" : "min-h-full",
                "bg-palette-soft text-palette-accent",
            )}
        >
            {tab.component === "chart" ? (
                // the chart derives its series from the palette: redraw it when that changes
                <ChartPanel
                    key={palette}
                    kind="area"
                    seed={5}
                    className="h-full"
                />
            ) : (
                <Card name={tab.data.name} />
            )}
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
