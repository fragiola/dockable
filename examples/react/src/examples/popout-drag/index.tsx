"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import {
    AppWindow,
    ArrowDownToLine,
    SquareArrowOutUpRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// Tabs move between windows like between tabsets: pop one out, then drag tabs into the window or
// out of it. The page's windows share one drag state, so a drag that starts in one window drops in
// another; each window draws its own outline (a DropIndicator inside Dockable.Popout, below).
// The content element moves with the tab, so the counter and the notes keep their values.

// What the layout holds: one tab component, named in its data.
type Types = { tabs: { card: { name: string } } };

const card = (name: string) => ({ component: "card" as const, data: { name } });

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [card("Orders"), card("Customers"), card("Invoices")],
            },
            {
                type: "tabset",
                weight: 50,
                children: [card("Chart"), card("Notes")],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function PopoutDrag() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter around
        // the layout goes on a wrapper: padding on the root would not move the row.
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                popoutURL={popoutURL}
                // copies <html> and <body>'s attributes (light/dark, the example theme) into each
                // popout window, kept in sync
                popoutMirrorRoot
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
            >
                {/* The layout's rows and tabsets: the developer owns the recursion. */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                {/* Every tab's content, in this window or a popout, positioned by the engine. */}
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            // panels sit in a layer above the tabsets, whose overflow cannot clip
                            // them: the panel repeats the tabset's inner radius on its corners
                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                        >
                            <Card name={tab.data.name}>
                                <p className="text-sm text-palette-accent/85">
                                    Pop this tab out, then drag tabs into its
                                    window, and back into this one.
                                </p>
                            </Card>
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <DropIndicator />
                {/* Each popout window: its own floor, rows and drop outline, portalled into the
                    window once it is ready. */}
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
 * A tabset: a card with the strip of tabs and its buttons on top, and the measured content area
 * below.
 */
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
                <div className="flex items-center gap-0.5 pe-1">
                    <WindowButtons tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** Two triggers: the selected tab, and the whole tabset. Each docks back from a window. */
function WindowButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    return (
        <>
            <Dockable.PopoutTrigger
                aria-label="Pop out the tab"
                data-testid="popout-tab"
                className={cn(
                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                    "focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
            >
                <SquareArrowOutUpRight
                    aria-hidden
                    className="size-3.5 in-data-[mode=dock]:hidden"
                />
                <ArrowDownToLine
                    aria-hidden
                    className="hidden size-3.5 in-data-[mode=dock]:block"
                />
            </Dockable.PopoutTrigger>
            {/* one trigger per tabset is enough in a window: the tab trigger docks back */}
            {tabset.children.length > 1 ? (
                <Dockable.PopoutTrigger
                    target="tabset"
                    aria-label="Pop out the whole tabset"
                    data-testid="popout-tabset"
                    className={cn(
                        "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                        "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                        "focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-40",
                        // hidden in a window (`data-mode="dock"`)
                        "data-[mode=dock]:hidden",
                    )}
                >
                    <AppWindow aria-hidden className="size-3.5" />
                </Dockable.PopoutTrigger>
            ) : null}
        </>
    );
}

/**
 * Where a dragged tab would land. Panels are portalled into the root after it, so it needs a
 * stacking order to paint above them.
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
