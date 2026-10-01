"use client";

import {
    type CommandError,
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useModelState,
} from "@fragiola/dockable-react";
import { RotateCcw, Save, Upload } from "lucide-react";
import { useState } from "react";
import { Card, PanelBody } from "../_kit/card";
import * as styles from "./styles";

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
                                {tab.component === "json" ? (
                                    <JsonPanel />
                                ) : (
                                    <Card name={tab.data.name} />
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
        </div>
    );
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
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>
                                {tab.data.name}
                            </span>
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
