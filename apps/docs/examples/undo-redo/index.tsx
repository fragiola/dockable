"use client";

import {
    type Action,
    Actions,
    DockLocation,
    type IJsonModel,
    Model,
    type OnModelChange,
    type TabNode,
    type TabSetNode,
    UndoManager,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Card, PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Undo and redo with the core's UndoManager. It owns the current model: it records a snapshot
// before every action and swaps in a new model on undo/redo (`Model.fromJson(json, current)`, so
// mounted content is kept). A splitter drag, many "adjusting" actions, is a single step.

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Layout JSON", component: "json" },
                    { type: "tab", name: "Welcome", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Notes", component: "card" },
                    { type: "tab", name: "Tasks", component: "card" },
                ],
            },
        ],
    },
};

// selecting a tab or a tabset is navigation, not an edit: it makes no undo step
const IGNORED = [Actions.SET_ACTIVE_TABSET, Actions.SELECT_TAB];

/** A short name for an action, for the history list. */
function describe(action: Action): string {
    switch (action.type) {
        case Actions.ADD_TAB:
            return "Add tab";
        case Actions.DELETE_TAB:
            return "Close tab";
        case Actions.MOVE_NODE:
            return "Move";
        case Actions.ADJUST_WEIGHTS:
            return "Resize";
        case Actions.MAXIMIZE_TOGGLE:
            return "Maximize";
        case Actions.RENAME_TAB:
            return "Rename";
        default:
            return action.type.replace(/^FlexLayout_/, "");
    }
}

let added = 0;

/** Add a tab to this tabset, and close its selected tab: two undoable edits. */
function TabsetButtons({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    const selected = tabset.getSelectedNode() as TabNode | undefined;
    return (
        <>
            <button
                type="button"
                aria-label="Add tab"
                className={styles.iconButton}
                onClick={() => {
                    added += 1;
                    engine.doAction(
                        Actions.addTab(
                            {
                                type: "tab",
                                name: `Tab ${added}`,
                                component: "card",
                            },
                            tabset.getId(),
                            DockLocation.CENTER,
                            -1,
                        ),
                    );
                }}
            >
                <Plus aria-hidden className="size-3.5" />
            </button>
            <button
                type="button"
                aria-label="Close selected tab"
                disabled={!selected?.isCloseable()}
                className={styles.iconButton}
                onClick={() =>
                    selected &&
                    engine.doAction(Actions.deleteTab(selected.getId()))
                }
            >
                <X aria-hidden className="size-3.5" />
            </button>
        </>
    );
}

/** The layout's JSON, live: undo brings back exactly the previous text. */
function LayoutJson() {
    const { model } = useDockable();
    return (
        <PanelBody title="Layout JSON">
            <pre
                data-testid="layout-json"
                className="m-0 overflow-auto rounded-md bg-palette-soft p-2 font-mono text-xs leading-5"
            >
                {JSON.stringify(model.toJson().layout, null, 2)}
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
    // one manager for the example's lifetime; it is garbage-collected with its model on unmount
    // (no dispose in an effect cleanup: StrictMode would dispose it and remount the same instance)
    const [undo] = useState(
        () =>
            new UndoManager(Model.fromJson(json), {
                ignoreActionTypes: IGNORED,
            }),
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

    // an action that the manager recorded as a step: the same rule it uses (not ignored, not a
    // step of a drag in progress)
    const onModelChange: OnModelChange = (_model, action) => {
        if (!action.isAdjusting() && !IGNORED.includes(action.type)) {
            setHistory((h) => ({
                done: [...h.done, describe(action)],
                undone: [],
            }));
        }
    };

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

    const model = snapshot.model;
    if (!model) {
        return null;
    }
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
                // a new model after each undo/redo: Root builds a new engine for it
                model={model}
                onModelChange={onModelChange}
                renderActions={(tabset) => <TabsetButtons tabset={tabset} />}
                renderContent={(tab) =>
                    tab.getComponent() === "json" ? (
                        <LayoutJson />
                    ) : (
                        <Card tab={tab} />
                    )
                }
            />
        </>
    );
}
