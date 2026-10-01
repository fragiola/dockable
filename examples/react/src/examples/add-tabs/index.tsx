"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { ChartLine, ScrollText, Table2 } from "lucide-react";
import { useRef, useState } from "react";
import { Select } from "#/components/ui/select";
import { cn } from "#/lib/cn";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";

// What the layout holds: each tab component and the type of its data.
type Types = {
    tabs: {
        chart: { name: string };
        table: { name: string };
        log: { name: string };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { component: "chart", data: { name: "Revenue" } },
                    { component: "table", data: { name: "Orders" } },
                ],
            },
        ],
    },
};

type Target = "active" | "right" | "bottom";

const TARGETS: { value: Target; label: string }[] = [
    { value: "active", label: "Active tabset" },
    { value: "right", label: "New tabset on the right" },
    { value: "bottom", label: "New tabset at the bottom" },
];

const KINDS = [
    { component: "chart", name: "Chart", icon: ChartLine },
    { component: "table", name: "Table", icon: Table2 },
    { component: "log", name: "Log", icon: ScrollText },
] as const;

export default function AddTabs() {
    const [model] = useState(() => createModel<Types>(json));
    const [target, setTarget] = useState<Target>("active");
    const count = useRef(0);

    // The toolbar is outside the layout: it runs commands on the model it owns, no engine needed.
    const add = (kind: (typeof KINDS)[number]) => {
        count.current += 1;
        const tab = {
            component: kind.component,
            data: { name: `${kind.name} ${count.current}` },
        };
        if (target === "active") {
            // the active tabset, or the first one when none is active yet
            const tabset =
                model.get("active-tabset") ?? model.get("tabsets")[0];
            // dropped into the tabset's centre, at the end (-1), and selected (with no tabset
            // left, into the layout itself: a new tabset)
            model.run("tab.add", {
                ...tab,
                to: tabset?.id ?? MAIN_LAYOUT,
                location: "center",
                index: -1,
                select: true,
            });
        } else {
            // dropped on an edge of the layout (its root row): a new tabset along that edge
            model.run("tab.add", {
                ...tab,
                to: MAIN_LAYOUT,
                location: target,
                select: true,
            });
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                {KINDS.map((kind) => (
                    <button
                        key={kind.component}
                        type="button"
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                            "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                            "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        onClick={() => add(kind)}
                    >
                        <kind.icon aria-hidden className="size-4" />
                        {`New ${kind.name.toLowerCase()}`}
                    </button>
                ))}
                <span className="ms-auto text-sm text-palette-accent/85">
                    Add to
                </span>
                <Select.Root
                    value={target}
                    onValueChange={(value) => setTarget(value as Target)}
                    items={TARGETS}
                >
                    <Select.Trigger
                        aria-label="Where to add"
                        data-testid="target"
                        className="w-64 shrink-0"
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {TARGETS.map((item) => (
                            <Select.Item key={item.value} value={item.value}>
                                {item.label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
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
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                <Content tab={tab} />
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

/** A tab's content: `tab.data` narrows on `tab.component`. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return <ChartPanel seed={tab.data.name.length * 7} />;
        case "table":
            return <TablePanel />;
        case "log":
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
