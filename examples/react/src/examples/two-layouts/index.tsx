"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDragGroup,
} from "@fragiola/dockable-react";
import { ArrowRight, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { TransferHistory } from "./history";

// Two layouts with their own models, in one Dockable.DragGroup: drag a tab from one into the
// other. Each model's middleware sees its side (a `tab.add` in the target, a `tab.close` in the
// source, both marked `meta.transfer`), and either can refuse. The tab's content moves with it.

// What both layouts hold: one tab component, named in its data. A transferred tab keeps its
// component and data, so the two models share the registry.
type Types = { tabs: { card: { name: string } } };

const card = (name: string) => ({ component: "card" as const, data: { name } });

const workspace: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [card("Report"), card("Chart"), card("Data")],
            },
        ],
    },
};

const scratch: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [{ type: "tabset", children: [card("Ideas")] }],
    },
};

type Models = { workspace: Model<Types>; scratch: Model<Types> };

export default function TwoLayouts() {
    const [models] = useState(() => ({
        workspace: createModel<Types>(workspace),
        scratch: createModel<Types>(scratch),
    }));
    return (
        // one drag group around both roots: a tab dragged out of one can drop into the other
        <Dockable.DragGroup>
            <div className="flex min-h-0 flex-1 flex-col">
                <HistoryBar models={models} />
                <div className="flex min-h-0 flex-1 divide-x divide-palette-line">
                    <section
                        aria-label="Workspace"
                        data-testid="pane-workspace"
                        className="flex min-w-0 flex-1 flex-col"
                    >
                        <h2 className="px-3 pt-2 text-xs font-semibold tracking-wide text-palette-accent/85 uppercase">
                            Workspace
                        </h2>
                        {/* Each root needs a size. Its row is `position: absolute; inset: 0`,
                            so the gutter around the layout goes on a wrapper: padding on the
                            root would not move the row. */}
                        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                            <Dockable.Root
                                model={models.workspace}
                                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                            >
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.Panels<Types>>
                                    {(tab) => (
                                        <Dockable.Panel
                                            node={tab}
                                            // panels sit in a layer above the tabsets,
                                            // whose overflow cannot clip them: the panel
                                            // repeats the tabset's inner radius on its
                                            // corners
                                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                                        >
                                            <Card name={tab.data.name} />
                                        </Dockable.Panel>
                                    )}
                                </Dockable.Panels>
                                <DropIndicator />
                            </Dockable.Root>
                        </div>
                    </section>
                    <section
                        aria-label="Scratch"
                        data-testid="pane-scratch"
                        className="flex min-w-0 flex-1 flex-col"
                    >
                        <h2 className="px-3 pt-2 text-xs font-semibold tracking-wide text-palette-accent/85 uppercase">
                            Scratch
                        </h2>
                        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                            <Dockable.Root
                                model={models.scratch}
                                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                            >
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.Panels<Types>>
                                    {(tab) => (
                                        <Dockable.Panel
                                            node={tab}
                                            // panels sit in a layer above the tabsets,
                                            // whose overflow cannot clip them: the panel
                                            // repeats the tabset's inner radius on its
                                            // corners
                                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                                        >
                                            <Card name={tab.data.name} />
                                        </Dockable.Panel>
                                    )}
                                </Dockable.Panels>
                                <DropIndicator />
                            </Dockable.Root>
                        </div>
                    </section>
                </div>
            </div>
        </Dockable.DragGroup>
    );
}

/** Which layout a model is, for the history list. */
function nameOf(model: Model<Types>, models: Models) {
    return model === models.workspace ? "Workspace" : "Scratch";
}

/** Undo, redo and the list of moves. Inside the DragGroup, so it can reach the group. */
function HistoryBar({ models }: { models: Models }) {
    const group = useDragGroup();
    const [history] = useState(
        () => new TransferHistory(group, [models.workspace, models.scratch]),
    );
    useEffect(() => history.connect(), [history]);
    const { undo, redo } = useSyncExternalStore(
        history.subscribe,
        history.getSnapshot,
        history.getSnapshot,
    );

    // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, except in text fields (they keep their own undo)
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable]")) return;
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "z"
            ) {
                event.preventDefault();
                if (event.shiftKey) history.redo();
                else history.undo();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [history]);

    const last = undo.at(-1);
    return (
        <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
            <button
                type="button"
                className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                )}
                disabled={undo.length === 0}
                onClick={() => history.undo()}
            >
                <Undo2 aria-hidden className="size-4" />
                Undo
            </button>
            <button
                type="button"
                className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                    "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                )}
                disabled={redo.length === 0}
                onClick={() => history.redo()}
            >
                <Redo2 aria-hidden className="size-4" />
                Redo
            </button>
            <p
                role="status"
                data-testid="last-move"
                className="ms-2 flex items-center gap-1.5 text-sm text-palette-accent/85"
            >
                {last ? (
                    <>
                        {`${last.name}: ${nameOf(last.from.model, models)}`}
                        <ArrowRight aria-hidden className="size-3.5" />
                        {nameOf(last.to.model, models)}
                    </>
                ) : (
                    "Drag a tab from one layout into the other."
                )}
            </p>
            <span className="ms-auto text-xs text-palette-accent/85">{`${undo.length} move(s) to undo`}</span>
        </div>
    );
}

/** A row's child, in either layout: a tabset, or a nested row rendered by this same function. */
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
 * Where a dragged tab would land, in either layout. Panels are portalled into the root after it,
 * so it needs a stacking order to paint above them.
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
