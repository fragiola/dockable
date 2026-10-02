"use client";

import {
    type CommandError,
    createModel,
    Dockable,
    type LayoutJson,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useModelState,
} from "@fragiola/dockable-react";
import { RotateCcw, Save, Upload } from "lucide-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// versioned: a layout saved with an older registry (its "card" tabs) is not restored
const STORAGE_KEY = "dockable-example:save-restore:v3";

type Types = {
    tabs: {
        json: undefined;
        doc: { text: string };
        table: undefined;
    };
};

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
                        component: "doc",
                        label: "Welcome",
                        data: {
                            text: "Move tabs or drag a splitter, then save. Reset brings back the default layout; Restore loads the saved one.",
                        },
                    },
                    {
                        id: "notes",
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "The tabs have explicit ids: a reset or a restore keeps every tab whose id survives, content and all.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "json",
                        component: "json",
                        label: "Layout JSON",
                    },
                    {
                        id: "inspector",
                        component: "table",
                        label: "Inspector",
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

export default function SaveRestore() {
    // one model for the example's lifetime: restoring or resetting loads a layout into it
    const [model] = useState(() => createModel<Types>(defaultJson));
    const [status, setStatus] = useState("Move tabs or resize, then save.");

    const save = () => {
        setStatus(
            writeSaved(model.get("layout-json"))
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
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={save}
                >
                    <Save aria-hidden className={styles.buttonIcon} />
                    Save
                </button>
                <button
                    type="button"
                    className={styles.button}
                    onClick={restore}
                >
                    <Upload aria-hidden className={styles.buttonIcon} />
                    Restore
                </button>
                <button type="button" className={styles.button} onClick={reset}>
                    <RotateCcw aria-hidden className={styles.buttonIcon} />
                    Reset
                </button>
                <output data-testid="status" className={styles.status}>
                    {status}
                </output>
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
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "json":
            return <JsonPanel />;
        case "doc":
            return (
                <PanelBody title={tab.label}>
                    <p>{tab.data.text}</p>
                </PanelBody>
            );
        case "table":
            return <TablePanel />;
    }
}

/** The model's JSON, live: this is everything there is to save. */
function JsonPanel() {
    const text = useModelState((_state, model) =>
        JSON.stringify(model.get("layout-json"), null, 2),
    );
    return (
        <PanelBody title='model.get("layout-json")'>
            <pre data-testid="layout-json" className={styles.layoutJson}>
                {text}
            </pre>
        </PanelBody>
    );
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
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
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
