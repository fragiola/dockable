"use client";

import {
    createModel,
    getSplitterPath,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useSplitter,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [{ component: "card", data: { name: "Library" } }],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            { component: "card", data: { name: "Draft" } },
                            { component: "card", data: { name: "Outline" } },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            { component: "card", data: { name: "Comments" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function SplitterWide() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
            >
                {/* every splitter of every row is the WideSplitter below */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <WideSplitter {...props} />}
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
                renderSplitter={(props) => <WideSplitter {...props} />}
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
 * A splitter built on the lower layer, `useSplitter`, instead of `Dockable.Splitter`: the hook
 * gives its state (`dragging`, `orientation`) and the props of the separator element (the ref,
 * `role`, the ARIA values, the pointer and keyboard handlers, and the structural style that hides
 * it while a tabset is maximized). The element is 12px thick (the engine measures it); a grip of
 * three dots sits in the middle, and while you drag or focus it a bubble shows `aria-valuetext`:
 * where the splitter sits in its row.
 */
function WideSplitter({ node, index }: RowSplitterProps<Types>) {
    const { state, props } = useSplitter(node, index);
    // the path (`/r0/s0`) comes from the row's own, which the engine knows by id
    const { engine } = useDockable<Types>();
    // the separator's orientation: "vertical" is a bar between side-by-side panes
    const vertical = state.orientation === "vertical";
    return (
        // biome-ignore lint/a11y/useSemanticElements: a focusable separator widget with a grip; an <hr> cannot hold children
        // biome-ignore lint/a11y/useFocusableInteractive: tabIndex={0} comes in props
        <div
            {...props}
            // biome-ignore lint/a11y/useAriaPropsForRole: aria-valuenow and the rest come in props
            role="separator"
            // a splitter has no name of its own: the app gives it one
            aria-label="Resize"
            data-layout-path={getSplitterPath(
                engine.get("layout-path-by", { nodeId: node.id }),
                index,
            )}
            data-orientation={state.orientation}
            data-dragging={state.dragging ? "" : undefined}
            className={[
                "group/splitter relative z-10 flex shrink-0 items-center justify-center rounded-full outline-none",
                "transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                "data-dragging:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                vertical
                    ? "w-3 cursor-ew-resize flex-col"
                    : "h-3 cursor-ns-resize flex-row",
            ].join(" ")}
        >
            {[0, 1, 2].map((dot) => (
                <span
                    key={dot}
                    aria-hidden="true"
                    className={[
                        "m-0.5 size-1 rounded-full bg-palette-line transition-colors",
                        "group-hover/splitter:bg-palette-accent group-data-dragging/splitter:bg-palette-ring",
                    ].join(" ")}
                />
            ))}
            <span
                aria-hidden="true"
                data-testid="splitter-readout"
                className={[
                    "palette-blue pointer-events-none absolute hidden rounded-md bg-palette-base px-1.5 py-0.5",
                    "text-xs font-medium tabular-nums text-palette-contrast shadow-sm",
                    "group-focus-visible/splitter:block group-data-dragging/splitter:block",
                    // just past the grip, centred on the bar
                    vertical
                        ? "start-1/2 top-[calc(50%+1.5rem)] -translate-x-1/2 rtl:translate-x-1/2"
                        : "start-[calc(50%+1.5rem)] top-1/2 -translate-y-1/2",
                ].join(" ")}
            >
                {props["aria-valuetext"]}
            </span>
        </div>
    );
}
