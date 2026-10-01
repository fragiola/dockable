"use client";

import {
    createModel,
    type TabOf,
    veto as vetoResult,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { labels } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
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

/** A tab with a close button: one more command to watch in the log. */
function LabTab({ tab }: { tab: TabOf<Types> }) {
    const { run } = useDockable<Types>();
    return (
        <>
            <span data-tab-label className={styles.tabLabel}>
                {tab.data.name}
            </span>
            <button
                type="button"
                tabIndex={-1}
                draggable={false}
                aria-label={`${labels.closeTab} ${tab.data.name}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    run("tab.close", { tab: tab.id });
                }}
                className={cn(styles.iconButton, "-me-1.5 size-5")}
            >
                <X aria-hidden="true" className="size-3" />
            </button>
        </>
    );
}

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
        const target = model.activeTabset() ?? model.tabsets()[0];
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
                json={model.toJSON()}
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
                <div className={styles.toolbar}>
                    <div className="flex items-center">
                        <button
                            type="button"
                            aria-label="Undo"
                            disabled={!history.canUndo}
                            onClick={() => undo.undo()}
                            className={cn(styles.button, "rounded-e-none px-2")}
                        >
                            <Undo2 aria-hidden="true" className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Redo"
                            disabled={!history.canRedo}
                            onClick={() => undo.redo()}
                            className={cn(
                                styles.button,
                                "-ms-px rounded-s-none px-2",
                            )}
                        >
                            <Redo2 aria-hidden="true" className="size-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={addTab}
                        className={styles.button}
                    >
                        <Plus aria-hidden="true" className="size-4" />
                        Add tab
                    </button>
                    <div className="ms-auto">
                        <VetoControl
                            veto={veto}
                            commands={model.commands()}
                            onChange={setVeto}
                        />
                    </div>
                </div>
                <DockLayout
                    model={model}
                    renderTab={(tab) => <LabTab tab={tab} />}
                    renderContent={(tab) => <Card tab={tab} />}
                />
                <CommandLog log={log} onClear={() => setLog([])} />
            </div>
        </div>
    );
}
