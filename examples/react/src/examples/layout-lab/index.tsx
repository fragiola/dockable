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
import { PanelBody } from "../_kit/card";
import { CHART_KINDS, ChartPanel } from "../_kit/charts";
import { LogPanel } from "../_kit/data";
import { UndoManager } from "../_kit/undo";
import {
    appendToLog,
    initialLayout,
    type LogEntry,
    type Types,
} from "./commands";
import { CommandLog, JsonEditor, type Veto, VetoControl } from "./panels";
import * as styles from "./styles";

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
        // a chart, of the next kind each time
        model.run("tab.add", {
            component: "chart",
            label: `Chart ${added}`,
            data: { kind: CHART_KINDS[added % CHART_KINDS.length] ?? "line" },
            to: target.id,
        });
    };

    return (
        <div className={styles.lab}>
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
            <div className={styles.main}>
                <div className={styles.toolbar}>
                    <div className={styles.history}>
                        <button
                            type="button"
                            aria-label="Undo"
                            disabled={!history.canUndo}
                            onClick={() => undo.undo()}
                            className={styles.undoButton}
                        >
                            <Undo2
                                aria-hidden="true"
                                className={styles.buttonIcon}
                            />
                        </button>
                        <button
                            type="button"
                            aria-label="Redo"
                            disabled={!history.canRedo}
                            onClick={() => undo.redo()}
                            className={styles.redoButton}
                        >
                            <Redo2
                                aria-hidden="true"
                                className={styles.buttonIcon}
                            />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={addTab}
                        className={styles.button}
                    >
                        <Plus
                            aria-hidden="true"
                            className={styles.buttonIcon}
                        />
                        Add tab
                    </button>
                    <div className={styles.vetoSlot}>
                        <VetoControl
                            veto={veto}
                            commands={model.get("commands")}
                            onChange={setVeto}
                        />
                    </div>
                </div>
                <div className={styles.frame}>
                    <Dockable.Root model={model} className={styles.root}>
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
                                    className={styles.panel}
                                >
                                    {tab.component === "chart" ? (
                                        <ChartPanel
                                            kind={tab.data.kind}
                                            seed={tab.label.length}
                                            title={tab.label}
                                        />
                                    ) : tab.component === "log" ? (
                                        <LogPanel />
                                    ) : (
                                        <PanelBody title={tab.label}>
                                            <p className={styles.cardText}>
                                                {tab.data?.text ??
                                                    "A card: its label names it, its data holds its text."}
                                            </p>
                                        </PanelBody>
                                    )}
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        {/* Where a dragged tab would land, animated at the layout's drag speed. */}
                        <Dockable.DropIndicator
                            className={styles.dropIndicator}
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
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            {/* a close button: one more command to watch in the log */}
                            <button
                                type="button"
                                tabIndex={-1}
                                draggable={false}
                                aria-label={`Close ${tab.label}`}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onClick={(event) => {
                                    event.stopPropagation();
                                    model.run("tab.close", { tabId: tab.id });
                                }}
                                className={styles.tabClose}
                            >
                                <X
                                    aria-hidden="true"
                                    className={styles.tabCloseIcon}
                                />
                            </button>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A border's strip: its tabs, with labels turned along a side border. */
function Border({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.Border node={node} className={styles.border}>
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => (
                    <Dockable.Tab node={tab} className={styles.borderTab}>
                        {tab.label}
                    </Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

/** Where a border's panel opens, with a splitter on the layout's side. */
function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={styles.borderContent}
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
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
