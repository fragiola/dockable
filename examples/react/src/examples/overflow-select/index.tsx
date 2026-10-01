"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Select } from "#/components/ui/select";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// Only the tabs that do not fit leave the strip: the engine measures the tab list and hides them
// (tab overflow), keeping the selected tab in view, and Dockable.TabOverflowTrigger (rendered only
// while tabs are hidden) is the trigger of a Fragiola Select listing just those. Picking one
// selects it, which brings it into the strip; another tab goes to the select in its place.

// What the layout holds: file tabs, named in their data. `altName` names a tab in the select when
// it has no name of its own (an icon-only tab).
type Types = { tabs: { file: { name: string; altName?: string } } };

const file = (name: string): TabJson<Types> => ({
    component: "file",
    data: { name },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 65,
                children: [
                    file("main.ts"),
                    file("App.tsx"),
                    file("layout.tsx"),
                    file("styles.css"),
                    file("api.ts"),
                    file("README.md"),
                ],
            },
            {
                type: "tabset",
                weight: 35,
                children: [file("Terminal"), file("Problems")],
            },
        ],
    },
};

export default function OverflowSelect() {
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

/** A tabset whose strip ends with the overflow select: the tabs that do not fit, listed. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const { hiddenTabs } = useTabOverflow(node);
    // a tab with no name (an icon-only tab) is named by its altName in the menu
    const label = (tab: TabOf<Types>) => tab.data.name || tab.data.altName;

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
                <Select.Root
                    value={null}
                    onValueChange={(id) => {
                        if (typeof id === "string") {
                            model.run("tab.select", { tabId: id });
                        }
                    }}
                >
                    {/* the package's trigger (measured, shown only while tabs are hidden),
                        rendered as the Select's trigger */}
                    <Dockable.TabOverflowTrigger
                        aria-label={`${hiddenTabs.length} more tabs`}
                        render={
                            <Select.Trigger className="my-1 me-1 h-auto w-auto shrink-0 gap-1 self-center px-2 py-0.5 text-xs" />
                        }
                    >
                        {`+${hiddenTabs.length}`}
                    </Dockable.TabOverflowTrigger>
                    <Select.Content>
                        {hiddenTabs.map((tab) => (
                            <Select.Item key={tab.id} value={tab.id}>
                                {label(tab)}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
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
