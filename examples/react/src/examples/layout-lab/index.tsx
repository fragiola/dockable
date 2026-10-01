"use client";

import {
    type BorderNode,
    createModel,
    type RowNode,
    type TabsetNode,
    veto as vetoResult,
} from "@fragiola/dockable";
import {
    Dockable,
    type SplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { UndoManager } from "../_kit/undo";
import {
    appendToLog,
    initialLayout,
    type LogEntry,
    type Types,
} from "./commands";
import { CommandLog, JsonEditor, type Veto, VetoControl } from "./panels";

// The model is the source of truth, made visible. Left: the model's JSON (v1), editable (Apply
// loads it with the `layout.load` command, validated first). Right: the layout it renders. Below:
// every command a middleware (`model.use`) sees, and a switch that vetoes one command (the
// middleware returns `veto(…)`, the model does not change). Undo and redo load the previous layout
// back into the same model.

let added = 0;

export default function LayoutLab() {
    // one model for the lab's lifetime: Apply, undo and redo load a layout into it
    const [model] = useState(() => createModel<Types>(initialLayout));
    const [undo] = useState(() => new UndoManager(model));
    const history = useSyncExternalStore(
        undo.subscribe,
        undo.getSnapshot,
        undo.getSnapshot,
    );
    // the state is immutable: a new object after every commit, so it is the snapshot to follow
    useSyncExternalStore(
        model.subscribe,
        () => model.state,
        () => model.state,
    );
    const [log, setLog] = useState<LogEntry[]>([]);
    const [veto, setVeto] = useState<Veto>({
        enabled: false,
        command: "tab.select",
    });

    // every command passes here first: log it, and apply it unless it is the vetoed one. The
    // middleware is installed once and reads the current choice from a ref.
    const vetoRef = useRef(veto);
    vetoRef.current = veto;
    useEffect(
        () =>
            model.use((ctx, next) => {
                const current = vetoRef.current;
                const vetoed =
                    current.enabled && ctx.command === current.command;
                const result = vetoed
                    ? vetoResult(`${ctx.command} is vetoed in the lab`)
                    : next();
                // a dry run (`model.can`: a drag hovering a target, a button's enabled state)
                // commits nothing, and a batch is logged once, as the batch
                if (!ctx.dryRun && !ctx.inBatch) {
                    setLog((log) =>
                        appendToLog(
                            log,
                            ctx.command,
                            ctx.payload,
                            result.ok ? "applied" : result.error.code,
                            ctx.transient,
                        ),
                    );
                }
                return result;
            }),
        [model],
    );

    const addTab = () => {
        const target = model.get("active-tabset") ?? model.get("tabsets")[0];
        if (!target) return;
        added += 1;
        model.run("tab.add", {
            component: "card",
            data: { name: `Tab ${added}` },
            to: target.id,
        });
    };

    return (
        <div className="flex min-h-0 flex-1 font-(family-name:--dk-font)">
            <JsonEditor
                json={model.get("layout-json")}
                // untrusted JSON: `dispatch` validates it (JSON v1, ids) before the layout
                // changes; a command like any other, so it is logged, vetoable and undoable
                onApply={(layout) =>
                    model.dispatch({
                        command: "layout.load",
                        payload: { layout },
                    })
                }
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                    <div className="flex items-center">
                        <button
                            type="button"
                            aria-label="Undo"
                            disabled={!history.canUndo}
                            onClick={() => undo.undo()}
                            className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-md rounded-e-none border border-palette-line bg-palette-base px-2 text-sm",
                                "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                                "disabled:pointer-events-none disabled:opacity-50",
                            )}
                        >
                            <Undo2 aria-hidden="true" className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Redo"
                            disabled={!history.canRedo}
                            onClick={() => undo.redo()}
                            className={cn(
                                "-ms-px inline-flex h-8 items-center gap-1.5 rounded-md rounded-s-none border border-palette-line bg-palette-base px-2 text-sm",
                                "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                                "disabled:pointer-events-none disabled:opacity-50",
                            )}
                        >
                            <Redo2 aria-hidden="true" className="size-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={addTab}
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
                            "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                            "disabled:pointer-events-none disabled:opacity-50",
                        )}
                    >
                        <Plus aria-hidden="true" className="size-4" />
                        Add tab
                    </button>
                    <div className="ms-auto">
                        <VetoControl
                            veto={veto}
                            commands={model.get("commands")}
                            onChange={setVeto}
                        />
                    </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                    <Dockable.Root
                        model={model}
                        className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                    >
                        {/* The JSON may give the layout borders: they are drawn around it. */}
                        <Dockable.Borders<Types>
                            renderBar={(border) => <Border node={border} />}
                            renderContent={(border) => (
                                <BorderContent node={border} />
                            )}
                        >
                            <Dockable.Row<Types>
                                renderSplitter={(props) => (
                                    <Splitter {...props} />
                                )}
                            >
                                {renderNode}
                            </Dockable.Row>
                        </Dockable.Borders>
                        <Dockable.Panels<Types>>
                            {(tab) => (
                                <Dockable.Panel
                                    node={tab}
                                    // panels sit in a layer above the tabsets, whose overflow
                                    // cannot clip them: the panel repeats the tabset's inner
                                    // radius on its corners
                                    className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
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
                <CommandLog log={log} onClear={() => setLog([])} />
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
    const { model } = useDockable<Types>();
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
                            {/* a close button: one more command to watch in the log */}
                            <button
                                type="button"
                                tabIndex={-1}
                                draggable={false}
                                aria-label={`Close ${tab.data.name}`}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onClick={(event) => {
                                    event.stopPropagation();
                                    model.run("tab.close", { tab: tab.id });
                                }}
                                className={cn(
                                    "-me-1.5 grid size-5 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                                    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                                )}
                            >
                                <X aria-hidden="true" className="size-3" />
                            </button>
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
/** A border's strip: its tabs, with labels turned along a side border. */
function Border({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.Border
            node={node}
            className={cn(
                "palette-surface shrink-0 bg-palette-base text-palette-contrast",
                "data-[orientation=vertical]:w-(--dk-tab-height) data-[orientation=horizontal]:h-(--dk-tab-height)",
                "data-[location=left]:border-e data-[location=right]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
                "data-drop-target:bg-palette-soft",
            )}
        >
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
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
                            // a side border's labels turn with `writing-mode`; a left border that
                            // reads "up" (`data-tab-direction`) turns them half a turn more
                            "in-data-[orientation=vertical]:[writing-mode:vertical-rl] in-data-[orientation=vertical]:px-1 in-data-[orientation=vertical]:py-2",
                            "in-data-[tab-direction=up]:rotate-180",
                        )}
                    >
                        {tab.data.name}
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

/**
 * Where a border's panel opens, with a splitter on the layout's side. An overlay border paints
 * over the layout: a stacking order, a shadow and a line on the side facing the layout.
 */
function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={cn(
                "data-overlay:z-30 data-overlay:shadow-xl data-overlay:border-palette-line",
                "data-overlay:data-[location=left]:border-e data-overlay:data-[location=right]:border-s",
                "data-overlay:data-[location=top]:border-b data-overlay:data-[location=bottom]:border-t",
            )}
            renderSplitter={(border) => <Splitter node={border} />}
        />
    );
}

/** The bar between two children of a row, or beside a border's panel. */
function Splitter(props: SplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                // an overlay border's splitter lies over the layout, not a gutter: it gets the
                // surface underneath, with the theme's splitter colour layered on top
                "in-data-overlay:bg-palette-base in-data-overlay:bg-[image:linear-gradient(var(--dk-splitter-bg),var(--dk-splitter-bg))]",
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
