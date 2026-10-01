"use client";

import {
    type CommandName,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
    useModelState,
} from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "#/lib/cn";
import { Card, PanelBody } from "../_kit/card";
import { UndoManager } from "../_kit/undo";

// Undo and redo with the examples' UndoManager (`_kit/undo.ts`: the package ships no undo). It
// listens to the model's commits (`model.subscribe`) and keeps the layout as it was before each
// step; undo and redo load it back into the same model (`layout.load`), so mounted content is
// kept. A splitter drag, many transient `row.resize` commands, is a single step.

// What the layout holds: demo cards and the live JSON, each named in its data.
type Types = { tabs: { card: { name: string }; json: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "json", data: { name: "Layout JSON" } },
                    { component: "card", data: { name: "Welcome" } },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Notes" } },
                    { component: "card", data: { name: "Tasks" } },
                ],
            },
        ],
    },
};

// selecting a tab or a tabset is navigation, not an edit: it makes no undo step
const IGNORED: readonly CommandName[] = ["tabset.activate", "tab.select"];

export default function UndoRedo() {
    // one model and one manager for the example's lifetime: undo and redo load a layout into the
    // same model, so nothing is swapped (and nothing is disposed in an effect cleanup: StrictMode
    // would dispose it and remount the same instance)
    const [model] = useState(() => createModel<Types>(json));
    const [undo] = useState(
        () => new UndoManager(model, { ignoreCommands: IGNORED }),
    );
    const snapshot = useSyncExternalStore(
        undo.subscribe,
        undo.getSnapshot,
        undo.getSnapshot,
    );
    // the names of the steps come from the manager's own steps: the command that made each one
    const doUndo = () => undo.undo();
    const doRedo = () => undo.redo();

    // Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redoes; text fields keep their own undo
    const keys = useRef({ doUndo, doRedo });
    keys.current = { doUndo, doRedo };
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                !(event.ctrlKey || event.metaKey) ||
                isTextField(event.target)
            ) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === "z" && !event.shiftKey) {
                keys.current.doUndo();
            } else if (key === "y" || (key === "z" && event.shiftKey)) {
                keys.current.doRedo();
            } else {
                return;
            }
            event.preventDefault();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <>
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
                        "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                    disabled={!snapshot.canUndo}
                    aria-keyshortcuts="Control+Z Meta+Z"
                    onClick={doUndo}
                >
                    <Undo2 aria-hidden className="size-4" />
                    Undo
                </button>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
                        "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                    disabled={!snapshot.canRedo}
                    aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
                    onClick={doRedo}
                >
                    <Redo2 aria-hidden className="size-4" />
                    Redo
                </button>
                <ol
                    aria-label="History"
                    className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs"
                >
                    {snapshot.undoCount + snapshot.redoCount === 0 ? (
                        <li className="text-palette-accent/85">
                            Move, resize, add or close tabs: each edit is a
                            step.
                        </li>
                    ) : null}
                    {[
                        ...snapshot.undoSteps.map((step) => ({
                            name: describe(step.command),
                            undone: false,
                        })),
                        // undone steps, oldest first, after the done ones
                        ...[...snapshot.redoSteps].reverse().map((step) => ({
                            name: describe(step.command),
                            undone: true,
                        })),
                    ].map((step, index) => (
                        <li
                            // biome-ignore lint/suspicious/noArrayIndexKey: a list of steps in order
                            key={index}
                            data-undone={step.undone ? "" : undefined}
                            className={cn(
                                "shrink-0 rounded-full border border-palette-line px-2 py-0.5",
                                "data-undone:border-dashed data-undone:text-palette-accent/85 data-undone:line-through",
                            )}
                        >
                            {step.name}
                        </li>
                    ))}
                </ol>
            </div>
            {/* The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter
                around the layout goes on a wrapper: padding on the root would not move the row. */}
            <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                <Dockable.Root
                    // the same model throughout: undo and redo change its state, not the model
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
                                {tab.component === "json" ? (
                                    <LayoutJsonPanel />
                                ) : (
                                    <Card name={tab.data.name} />
                                )}
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
        </>
    );
}

/** A short name for a command, for the history list. */
function describe(command: CommandName): string {
    switch (command) {
        case "tab.add":
            return "Add tab";
        case "tab.close":
            return "Close tab";
        case "tab.move":
        case "tabset.move":
            return "Move";
        case "row.resize":
            return "Resize";
        case "tabset.maximize":
            return "Maximize";
        case "tab.update":
            return "Rename";
        default:
            return command;
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

/** A tabset: the strip of tabs and its buttons on top, the measured content area below. */
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
                    <TabsetButtons tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** Numbers the tabs the add button creates. */
let added = 0;

/** Add a tab to this tabset, and close its selected tab: two undoable edits. */
function TabsetButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const selected = model.get("selected-tab-by-tabset-id", {
        tabsetId: tabset.id,
    });
    const closeable =
        selected !== undefined &&
        model.can("tab.close", { tabId: selected.id });
    return (
        <>
            <button
                type="button"
                aria-label="Add tab"
                className={cn(
                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                    "focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
                onClick={() => {
                    added += 1;
                    model.run("tab.add", {
                        component: "card",
                        data: { name: `Tab ${added}` },
                        to: tabset.id,
                    });
                }}
            >
                <Plus aria-hidden className="size-3.5" />
            </button>
            <button
                type="button"
                aria-label="Close selected tab"
                disabled={!closeable}
                className={cn(
                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                    "focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
                onClick={() =>
                    selected && model.run("tab.close", { tabId: selected.id })
                }
            >
                <X aria-hidden className="size-3.5" />
            </button>
        </>
    );
}

/** The layout's JSON, live: undo brings back exactly the previous text. */
function LayoutJsonPanel() {
    const text = useModelState((_state, model) =>
        JSON.stringify(model.get("layout-json"), null, 2),
    );
    return (
        <PanelBody title="Layout JSON">
            <pre
                data-testid="layout-json"
                className="m-0 overflow-auto rounded-md bg-palette-soft p-2 font-mono text-xs leading-5"
            >
                {text}
            </pre>
        </PanelBody>
    );
}

function isTextField(target: EventTarget | null) {
    const element = target as HTMLElement | null;
    return (
        element?.isContentEditable ||
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA"
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
