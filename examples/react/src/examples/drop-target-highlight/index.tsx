"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useTabSetDropState,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// No drop outline at all (the root has no `Dockable.DropIndicator`): the targets show themselves.
// While a drag would drop into (or beside) a tabset, it has `data-drop-target` and
// `data-drop-location` (center, top, bottom, left, right); a drop into its tab strip also gives the
// insertion index. The styles read only those.

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "card", data: { name: "Alpha" } },
                    { component: "card", data: { name: "Beta" } },
                    { component: "card", data: { name: "Gamma" } },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Delta" } },
                            { component: "card", data: { name: "Epsilon" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Zeta" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function DropTargetHighlight() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter around
        // the layout goes on a wrapper: padding on the root would not move the row.
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
                            <Card name={tab.data.name} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* no Dockable.DropIndicator: the highlights in TabSet replace the outline */}
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

/** A tabset that marks itself while it is a drop target: a ring or a side bar, and a caret in its strip. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { engine } = useDockable<Types>();
    // the same answer the tabset's data-* come from: is a strip drop aimed here, and where?
    const drop = useTabSetDropState(engine, node.id);
    const tabs = node.children;
    return (
        <Dockable.TabSet
            node={node}
            className={cn(
                "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
                // a bar on the side of the tabset the drag would dock to (or all around, for the
                // centre)
                "data-drop-target:ring-2 data-drop-target:ring-palette-ring/40",
                "data-[drop-location=center]:ring-4 data-[drop-location=center]:ring-palette-ring",
                "data-[drop-location=top]:shadow-[inset_0_4px_0_var(--palette-ring)]",
                "data-[drop-location=bottom]:shadow-[inset_0_-4px_0_var(--palette-ring)]",
                "data-[drop-location=left]:shadow-[inset_4px_0_0_var(--palette-ring)]",
                "data-[drop-location=right]:shadow-[inset_-4px_0_0_var(--palette-ring)]",
                "transition-shadow duration-(--dk-motion)",
            )}
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => {
                        const index = tabs.findIndex((t) => t.id === tab.id);
                        const before = drop.strip && drop.index === index;
                        const after =
                            drop.strip &&
                            drop.index === tabs.length &&
                            index === tabs.length - 1;
                        return (
                            <Dockable.Tab
                                node={tab}
                                className={cn(
                                    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                                    // a caret before (or after) the tab, at the strip's insertion
                                    // point
                                    (before || after) &&
                                        "before:pointer-events-none before:absolute before:inset-y-1 before:w-0.5 before:rounded-full before:bg-palette-ring",
                                    before && "before:-start-0.5",
                                    after && "before:-end-0.5",
                                )}
                            >
                                <span className="truncate">
                                    {tab.data.name}
                                </span>
                                {/* the active tabset's marker: `in-data-active:` reads the
                                    enclosing TabSet's data-active, `group-data-selected/tab:`
                                    this tab's */}
                                <span
                                    aria-hidden="true"
                                    className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                                />
                            </Dockable.Tab>
                        );
                    }}
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
