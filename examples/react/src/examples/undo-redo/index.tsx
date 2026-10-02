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
import { PanelBody } from "../_kit/card";
import { CHART_KINDS, type ChartKind, ChartPanel } from "../_kit/charts";
import { UndoManager } from "../_kit/undo";
import * as styles from "./styles";

// Undo and redo with the examples' UndoManager (`_kit/undo.ts`: the package ships no undo). It
// listens to the model's commits (`model.subscribe`) and keeps the layout as it was before each
// step; undo and redo load it back into the same model (`layout.load`), so mounted content is
// kept. A splitter drag, many transient `row.resize` commands, is a single step.

// What the layout holds: the live JSON, short documents and charts, each named by its label.
type Types = {
    tabs: {
        json: undefined;
        doc: { text: string };
        chart: { kind: ChartKind; seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "json", label: "Layout JSON" },
                    {
                        component: "doc",
                        label: "Welcome",
                        data: {
                            text: "Move a tab, drag a splitter, add or close tabs: each edit is a step in the history above.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "Selecting a tab or a tabset is navigation, not an edit: it adds no step.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Tasks",
                        data: { kind: "bar", seed: 4 },
                    },
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
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.button}
                    disabled={!snapshot.canUndo}
                    aria-keyshortcuts="Control+Z Meta+Z"
                    onClick={doUndo}
                >
                    <Undo2 aria-hidden className={styles.buttonIcon} />
                    Undo
                </button>
                <button
                    type="button"
                    className={styles.button}
                    disabled={!snapshot.canRedo}
                    aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
                    onClick={doRedo}
                >
                    <Redo2 aria-hidden className={styles.buttonIcon} />
                    Redo
                </button>
                <ol aria-label="History" className={styles.history}>
                    {snapshot.undoCount + snapshot.redoCount === 0 ? (
                        <li className={styles.historyHint}>
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
                            className={styles.historyStep}
                        >
                            {step.name}
                        </li>
                    ))}
                </ol>
            </div>
            {/* The root needs a size: the wrapper gives it one, and the gutter around it. */}
            <div className={styles.frame}>
                <Dockable.Root
                    // the same model throughout: undo and redo change its state, not the model
                    model={model}
                    className={styles.root}
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {tab.component === "json" ? (
                                    <LayoutJsonPanel />
                                ) : tab.component === "doc" ? (
                                    <PanelBody title={tab.label}>
                                        <p>{tab.data.text}</p>
                                    </PanelBody>
                                ) : (
                                    <ChartPanel
                                        kind={tab.data.kind}
                                        seed={tab.data.seed}
                                        title={tab.label}
                                    />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
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
        case "tab.configure":
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
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.tabsetButtons}>
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
    const selected = model.get("selected-tab-by", {
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
                className={styles.iconButton}
                onClick={() => {
                    added += 1;
                    // a new chart, of the next kind in turn
                    model.run("tab.add", {
                        component: "chart",
                        label: `Tab ${added}`,
                        data: {
                            kind:
                                CHART_KINDS[added % CHART_KINDS.length] ??
                                "line",
                            seed: added * 3,
                        },
                        to: tabset.id,
                    });
                }}
            >
                <Plus aria-hidden className={styles.iconButtonIcon} />
            </button>
            <button
                type="button"
                aria-label="Close selected tab"
                disabled={!closeable}
                className={styles.iconButton}
                onClick={() =>
                    selected && model.run("tab.close", { tabId: selected.id })
                }
            >
                <X aria-hidden className={styles.iconButtonIcon} />
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
            <pre data-testid="layout-json" className={styles.layoutJson}>
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

/** The bar between two children of a row, with a grip for the themes that show one. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
