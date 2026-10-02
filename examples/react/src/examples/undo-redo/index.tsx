"use client";

import {
    type CommandName,
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PanelBody } from "../_kit/card";
import { CHART_KINDS, type ChartKind, ChartPanel } from "../_kit/charts";
import { handleUndoKeys, UndoManager } from "../_kit/undo";
import * as styles from "./styles";

// Undo and redo with the examples' UndoManager (`_kit/undo.ts`: the package ships no undo). It
// listens to the model's commits (`model.subscribe`) and keeps the layout as it was before each
// step; undo and redo load it back into the same model (`layout.load`), so mounted content is
// kept. A splitter drag, many transient `row.resize` commands, is a single step.

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
    // same model, so nothing is swapped
    const [model] = useState(() => createModel<Types>(json));
    const [undo] = useState(
        () => new UndoManager(model, { ignoreCommands: IGNORED }),
    );
    const snapshot = useSyncExternalStore(
        undo.subscribe,
        undo.getSnapshot,
        undo.getSnapshot,
    );

    // Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redoes
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => handleUndoKeys(undo, event);
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [undo]);

    return (
        <>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.button}
                    disabled={!snapshot.canUndo}
                    aria-keyshortcuts="Control+Z Meta+Z"
                    onClick={() => undo.undo()}
                >
                    <Undo2 aria-hidden className={styles.buttonIcon} />
                    Undo
                </button>
                <button
                    type="button"
                    className={styles.button}
                    disabled={!snapshot.canRedo}
                    aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
                    onClick={() => undo.redo()}
                >
                    <Redo2 aria-hidden className={styles.buttonIcon} />
                    Redo
                </button>
                <ol aria-label="History" className={styles.history}>
                    {snapshot.undoSteps.length + snapshot.redoSteps.length ===
                    0 ? (
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
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <Content tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "json":
            return <LayoutJsonPanel />;
        case "doc":
            return (
                <PanelBody title={tab.label}>
                    <p>{tab.data.text}</p>
                </PanelBody>
            );
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.data.seed}
                    title={tab.label}
                />
            );
    }
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
