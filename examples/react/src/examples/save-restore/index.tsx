"use client";

import {
    type CommandError,
    createModel,
    type LayoutJson,
} from "@fragiola/dockable";
import { useModelState } from "@fragiola/dockable-react";
import { RotateCcw, Save, Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card, PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

const STORAGE_KEY = "dockable-example:save-restore";

// What the layout holds: demo cards and the live JSON, each named in its data.
type Types = { tabs: { card: { name: string }; json: { name: string } } };

// Explicit ids: a reset or a restore keeps every tab whose id survives, content and all.
const defaultJson: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "welcome",
                        component: "card",
                        data: { name: "Welcome" },
                    },
                    { id: "notes", component: "card", data: { name: "Notes" } },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "json",
                        component: "json",
                        data: { name: "Layout JSON" },
                    },
                    {
                        id: "inspector",
                        component: "card",
                        data: { name: "Inspector" },
                    },
                ],
            },
        ],
    },
};

// Storage can throw (private mode, a full quota, storage disabled): never let it break the app.
// What comes back is untrusted text: `layout.load` validates it before anything changes.
function readSaved(): unknown {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        return text ? JSON.parse(text) : undefined;
    } catch {
        return undefined;
    }
}

function writeSaved(json: LayoutJson<Types>): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
        return true;
    } catch {
        return false;
    }
}

/** Why a stored layout was refused: the message and the JSON path of each problem. */
function describeError(error: CommandError): string {
    const issues = error.issues ?? [];
    if (issues.length === 0) {
        return error.message;
    }
    return issues
        .map((issue) => `${issue.path || "/"} ${issue.message}`)
        .join("; ");
}

/** The model's JSON, live: this is everything there is to save. */
function JsonPanel() {
    const text = useModelState((_state, model) =>
        JSON.stringify(model.toJSON(), null, 2),
    );
    return (
        <PanelBody title="model.toJSON()">
            <pre
                data-testid="layout-json"
                className="m-0 overflow-auto rounded-md bg-palette-soft p-3 font-mono text-xs leading-5"
            >
                {text}
            </pre>
        </PanelBody>
    );
}

export default function SaveRestore() {
    // one model for the example's lifetime: restoring or resetting loads a layout into it
    const [model] = useState(() => createModel<Types>(defaultJson));
    const [status, setStatus] = useState("Move tabs or resize, then save.");

    const save = () => {
        setStatus(
            writeSaved(model.toJSON())
                ? "Saved to localStorage."
                : "Could not save: storage is unavailable.",
        );
    };
    const restore = () => {
        const saved = readSaved();
        if (saved === undefined) {
            setStatus("Nothing saved yet.");
            return;
        }
        // `dispatch` takes untrusted JSON: the stored layout is validated against JSON v1 (and
        // its ids checked) before it replaces the current one, in place
        const result = model.dispatch({
            command: "layout.load",
            payload: { layout: saved },
        });
        setStatus(
            result.ok
                ? "Restored from localStorage."
                : `Could not restore: ${describeError(result.error)}`,
        );
    };
    const reset = () => {
        model.run("layout.load", { layout: defaultJson });
        setStatus("Reset to the default layout.");
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={cn("palette-blue", styles.solidButton)}
                    onClick={save}
                >
                    <Save aria-hidden className="size-4" />
                    Save
                </button>
                <button
                    type="button"
                    className={styles.button}
                    onClick={restore}
                >
                    <Upload aria-hidden className="size-4" />
                    Restore
                </button>
                <button type="button" className={styles.button} onClick={reset}>
                    <RotateCcw aria-hidden className="size-4" />
                    Reset
                </button>
                <output
                    data-testid="status"
                    className="ms-auto text-sm text-palette-accent/85"
                >
                    {status}
                </output>
            </div>
            <DockLayout
                model={model}
                renderContent={(tab) =>
                    tab.component === "json" ? (
                        <JsonPanel />
                    ) : (
                        <Card tab={tab} />
                    )
                }
            />
        </div>
    );
}
