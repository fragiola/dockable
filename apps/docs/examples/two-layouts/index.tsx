"use client";

import { type IJsonModel, Model } from "@fragiola/dockable";
import { Dockable, useDragGroup } from "@fragiola/dockable-react";
import { ArrowRight, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { TransferHistory } from "./history";

// Two layouts with their own models, in one Dockable.DragGroup: drag a tab from one into the
// other. Each layout's onAction sees its side (an addTab in the target, a deleteTab in the source,
// both marked as a transfer), and either can refuse. The tab's content moves with it.

const workspace: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { type: "tab", name: "Report", component: "card" },
                    { type: "tab", name: "Chart", component: "card" },
                    { type: "tab", name: "Data", component: "card" },
                ],
            },
        ],
    },
};

const scratch: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [{ type: "tab", name: "Ideas", component: "card" }],
            },
        ],
    },
};

/** Which layout a model is, for the history list. */
function nameOf(model: Model, models: { workspace: Model; scratch: Model }) {
    return model === models.workspace ? "Workspace" : "Scratch";
}

/** Undo, redo and the list of moves. Inside the DragGroup, so it can reach the group. */
function HistoryBar({
    models,
}: {
    models: { workspace: Model; scratch: Model };
}) {
    const group = useDragGroup();
    const [history] = useState(() => new TransferHistory(group));
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
        <div className={styles.toolbar}>
            <button
                type="button"
                className={styles.button}
                disabled={undo.length === 0}
                onClick={() => history.undo()}
            >
                <Undo2 aria-hidden className="size-4" />
                Undo
            </button>
            <button
                type="button"
                className={styles.button}
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

function Pane({ title, model }: { title: string; model: Model }) {
    return (
        <section
            aria-label={title}
            data-testid={`pane-${title.toLowerCase()}`}
            className="flex min-w-0 flex-1 flex-col"
        >
            <h2 className="px-3 pt-2 text-xs font-semibold tracking-wide text-palette-accent/85 uppercase">
                {title}
            </h2>
            <DockLayout
                model={model}
                renderContent={(tab) => <Card tab={tab} />}
            />
        </section>
    );
}

export default function TwoLayouts() {
    const [models] = useState(() => ({
        workspace: Model.fromJson(workspace),
        scratch: Model.fromJson(scratch),
    }));
    return (
        <Dockable.DragGroup>
            <div className="flex min-h-0 flex-1 flex-col">
                <HistoryBar models={models} />
                <div className="flex min-h-0 flex-1 divide-x divide-palette-line">
                    <Pane title="Workspace" model={models.workspace} />
                    <Pane title="Scratch" model={models.scratch} />
                </div>
            </div>
        </Dockable.DragGroup>
    );
}
