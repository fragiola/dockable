"use client";

import {
    type CommandEvent,
    type CommandName,
    createModel,
    type LayoutJson,
    type TabsetNode,
} from "@fragiola/dockable";
import { useDockable, useModelState } from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "#/lib/cn";
import { Card, PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
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

/** A command (or a batch of only such commands) that makes no undo step: the manager's rule. */
function isIgnored(event: CommandEvent<Types>): boolean {
    const commands =
        event.command === "batch"
            ? (event.commands ?? []).map((step) => step.command)
            : [event.command];
    return (
        commands.length > 0 &&
        commands.every((command) => IGNORED.includes(command))
    );
}

let added = 0;

/** Add a tab to this tabset, and close its selected tab: two undoable edits. */
function TabsetButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, run } = useDockable<Types>();
    const selected = model.selectedTab(tabset.id);
    const closeable =
        selected !== undefined &&
        model.can("tab.close", { tab: selected.id }).ok;
    return (
        <>
            <button
                type="button"
                aria-label="Add tab"
                className={styles.iconButton}
                onClick={() => {
                    added += 1;
                    run("tab.add", {
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
                className={styles.iconButton}
                onClick={() =>
                    selected && run("tab.close", { tab: selected.id })
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
        JSON.stringify(model.toJSON(), null, 2),
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
    // the names of the steps: done (undoable) and undone (redoable), newest last
    const [history, setHistory] = useState({
        done: [] as string[],
        undone: [] as string[],
    });

    // a commit that the manager records as a step, by the same rule it uses: not an undo or a
    // redo (`meta.undo`), not ignored, not a transient step of a drag in progress (its last,
    // non-transient command ends the gesture and names the step)
    useEffect(() => {
        let gesture = false;
        return model.subscribe((event) => {
            if (event.meta?.undo === true || isIgnored(event)) {
                return;
            }
            if (event.transient) {
                gesture = true;
                return;
            }
            if (event.before === event.after && !gesture) {
                return; // a command that changed nothing
            }
            gesture = false;
            setHistory((h) => ({
                done: [...h.done, describe(event.command)],
                undone: [],
            }));
        });
    }, [model]);

    const doUndo = () => {
        if (!undo.canUndo) return;
        undo.undo();
        setHistory((h) => ({
            done: h.done.slice(0, -1),
            undone: [...h.undone, ...h.done.slice(-1)],
        }));
    };
    const doRedo = () => {
        if (!undo.canRedo) return;
        undo.redo();
        setHistory((h) => ({
            done: [...h.done, ...h.undone.slice(-1)],
            undone: h.undone.slice(0, -1),
        }));
    };

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
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.button}
                    disabled={!snapshot.canUndo}
                    aria-keyshortcuts="Control+Z Meta+Z"
                    onClick={doUndo}
                >
                    <Undo2 aria-hidden className="size-4" />
                    Undo
                </button>
                <button
                    type="button"
                    className={styles.button}
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
                    {history.done.length + history.undone.length === 0 ? (
                        <li className="text-palette-accent/85">
                            Move, resize, add or close tabs: each edit is a
                            step.
                        </li>
                    ) : null}
                    {[
                        ...history.done.map((name) => ({
                            name,
                            undone: false,
                        })),
                        // undone steps, oldest first, after the done ones
                        ...[...history.undone]
                            .reverse()
                            .map((name) => ({ name, undone: true })),
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
            <DockLayout
                // the same model throughout: undo and redo change its state, not the model
                model={model}
                renderActions={(tabset) => <TabsetButtons tabset={tabset} />}
                renderContent={(tab) =>
                    tab.component === "json" ? (
                        <LayoutJsonPanel />
                    ) : (
                        <Card tab={tab} />
                    )
                }
            />
        </>
    );
}
