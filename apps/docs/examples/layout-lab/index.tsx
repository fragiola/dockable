"use client";

import {
    type Action,
    Actions,
    DockableLabel,
    DockLocation,
    type LayoutEngine,
    Model,
    type TabNode,
    UndoManager,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Plus, Redo2, Undo2, X } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { EngineBridge } from "../_kit/engine-bridge";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { usePopupTheme } from "../_kit/theme";
import { appendToLog, initialLayout, type LogEntry } from "./actions";
import { ActionLog, JsonEditor, type Veto, VetoControl } from "./panels";

// The model is the source of truth, made visible. Left: the model's JSON, editable (Apply builds
// a new model with Model.fromJson). Right: the layout it renders. Below: every action onAction
// receives, and a switch that vetoes one action type (onAction returns undefined, the model does
// not change). Undo and redo swap in the previous model.

/** A tab with a close button: one more action to watch in the log. */
function LabTab({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    return (
        <>
            <span data-tab-label className={styles.tabLabel}>
                {tab.getName()}
            </span>
            <button
                type="button"
                tabIndex={-1}
                draggable={false}
                aria-label={`${label(DockableLabel.Close_Tab)} ${tab.getName()}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    engine.doAction(Actions.deleteTab(tab.getId()));
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
    const [undo] = useState(
        () => new UndoManager(Model.fromJson(initialLayout)),
    );
    const history = useSyncExternalStore(
        undo.subscribe,
        undo.getSnapshot,
        undo.getSnapshot,
    );
    const [engine, setEngine] = useState<LayoutEngine | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [veto, setVeto] = useState<Veto>({
        enabled: false,
        type: Actions.SELECT_TAB,
    });
    const [, setRevision] = useState(0);
    const toolbar = useRef<HTMLDivElement | null>(null);
    const popupTheme = usePopupTheme(toolbar);
    const model = history.model;

    // every change passes here first: log it, and apply it unless its type is vetoed
    const onAction = (action: Action) => {
        const vetoed = veto.enabled && action.type === veto.type;
        setLog((current) => appendToLog(current, action, vetoed));
        return vetoed ? undefined : action;
    };

    const addTab = () => {
        const target = model?.getActiveTabset() ?? model?.getFirstTabSet();
        if (!engine || !target) return;
        added += 1;
        engine.doAction(
            Actions.addTab(
                { type: "tab", name: `Tab ${added}`, component: "card" },
                target.getId(),
                DockLocation.CENTER,
                -1,
            ),
        );
    };

    if (!model) return null;
    return (
        <div className="flex min-h-0 flex-1 font-(family-name:--dk-font)">
            <JsonEditor
                json={model.toJson()}
                onApply={(next) => {
                    // a whole new model: not an action, so it starts a new undo history
                    undo.setModel(next);
                }}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <div ref={toolbar} className={styles.toolbar}>
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
                        disabled={!engine}
                        className={styles.button}
                    >
                        <Plus aria-hidden="true" className="size-4" />
                        Add tab
                    </button>
                    <div className="ms-auto">
                        <VetoControl
                            veto={veto}
                            onChange={setVeto}
                            popupTheme={popupTheme}
                        />
                    </div>
                </div>
                <DockLayout
                    model={model}
                    onAction={onAction}
                    onModelChange={() => setRevision((n) => n + 1)}
                    renderTab={(tab) => <LabTab tab={tab} />}
                    renderContent={(tab) => <Card tab={tab} />}
                >
                    <EngineBridge onEngine={setEngine} />
                </DockLayout>
                <ActionLog log={log} onClear={() => setLog([])} />
            </div>
        </div>
    );
}
