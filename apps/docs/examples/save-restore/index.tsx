"use client";

import { type IJsonModel, Model, type TabNode } from "@fragiola/dockable";
import { RotateCcw, Save, Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Card, PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

const STORAGE_KEY = "dockable-example:save-restore";

const defaultJson: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Welcome", component: "card" },
                    { type: "tab", name: "Notes", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Layout JSON", component: "json" },
                    { type: "tab", name: "Inspector", component: "card" },
                ],
            },
        ],
    },
};

// Storage can throw (private mode, a full quota, storage disabled): never let it break the app.
function readSaved(): IJsonModel | undefined {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        return text ? (JSON.parse(text) as IJsonModel) : undefined;
    } catch {
        return undefined;
    }
}

function writeSaved(json: IJsonModel): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
        return true;
    } catch {
        return false;
    }
}

/** The model's JSON, live: this is everything there is to save. */
function JsonPanel({ model }: { model: Model }) {
    return (
        <PanelBody title="model.toJson()">
            <pre
                data-testid="layout-json"
                className="m-0 overflow-auto rounded-md bg-palette-soft p-3 font-mono text-xs leading-5"
            >
                {JSON.stringify(model.toJson().layout, null, 2)}
            </pre>
        </PanelBody>
    );
}

export default function SaveRestore() {
    const [model, setModel] = useState(() => Model.fromJson(defaultJson));
    const [status, setStatus] = useState("Move tabs or resize, then save.");
    // bumped on every model change, so the JSON panel re-renders with the new layout
    const [, setRevision] = useState(0);

    const save = () => {
        setStatus(
            writeSaved(model.toJson())
                ? "Saved to localStorage."
                : "Could not save: storage is unavailable.",
        );
    };
    const restore = () => {
        const saved = readSaved();
        if (!saved) {
            setStatus("Nothing saved yet.");
            return;
        }
        // A new model is a new layout: the Root builds a new engine for it.
        setModel(Model.fromJson(saved));
        setStatus("Restored from localStorage.");
    };
    const reset = () => {
        setModel(Model.fromJson(defaultJson));
        setStatus("Reset to the default layout.");
    };

    const renderContent = (tab: TabNode) =>
        tab.getComponent() === "json" ? (
            <JsonPanel model={model} />
        ) : (
            <Card tab={tab} />
        );

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
                onModelChange={() => setRevision((r) => r + 1)}
                renderContent={renderContent}
            />
        </div>
    );
}
