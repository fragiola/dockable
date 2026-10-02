"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDragGroup,
} from "@fragiola/dockable-react";
import { ArrowRight, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "../_kit/card";
import { TransferHistory } from "./history";
import * as styles from "./styles";

// Two layouts with their own models, in one Dockable.DragGroup: drag a tab from one into the
// other. Each model's middleware sees its side (a `tab.add` in the target, a `tab.close` in the
// source, both marked `meta.transfer`), and either can refuse. The tab's content moves with it.

// What both layouts hold: one tab component, named by its label. A transferred tab keeps its label,
// component and data, so the two models share the registry.
type Types = { tabs: { card: undefined } };

const card = (name: string) => ({ component: "card" as const, label: name });

const workspace: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [card("Report"), card("Chart"), card("Data")],
            },
        ],
    },
};

const scratch: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [{ type: "tabset", children: [card("Ideas")] }],
    },
};

type Models = { workspace: Model<Types>; scratch: Model<Types> };

export default function TwoLayouts() {
    const [models] = useState(() => ({
        workspace: createModel<Types>(workspace),
        scratch: createModel<Types>(scratch),
    }));
    return (
        // one drag group around both roots: a tab dragged out of one can drop into the other
        <Dockable.DragGroup>
            <div className={styles.page}>
                <HistoryBar models={models} />
                <div className={styles.panes}>
                    <section
                        aria-label="Workspace"
                        data-testid="pane-workspace"
                        className={styles.pane}
                    >
                        <h2 className={styles.paneTitle}>Workspace</h2>
                        <div className={styles.frame}>
                            <Dockable.Root
                                model={models.workspace}
                                className={styles.root}
                            >
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.Panels<Types>>
                                    {(tab) => (
                                        <Dockable.Panel
                                            node={tab}
                                            className={styles.panel}
                                        >
                                            <Card name={tab.label} />
                                        </Dockable.Panel>
                                    )}
                                </Dockable.Panels>
                                <DropIndicator />
                            </Dockable.Root>
                        </div>
                    </section>
                    <section
                        aria-label="Scratch"
                        data-testid="pane-scratch"
                        className={styles.pane}
                    >
                        <h2 className={styles.paneTitle}>Scratch</h2>
                        <div className={styles.frame}>
                            <Dockable.Root
                                model={models.scratch}
                                className={styles.root}
                            >
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.Panels<Types>>
                                    {(tab) => (
                                        <Dockable.Panel
                                            node={tab}
                                            className={styles.panel}
                                        >
                                            <Card name={tab.label} />
                                        </Dockable.Panel>
                                    )}
                                </Dockable.Panels>
                                <DropIndicator />
                            </Dockable.Root>
                        </div>
                    </section>
                </div>
            </div>
        </Dockable.DragGroup>
    );
}

/** Which layout a model is, for the history list. */
function nameOf(model: Model<Types>, models: Models) {
    return model === models.workspace ? "Workspace" : "Scratch";
}

/** Undo, redo and the list of moves. Inside the DragGroup, so it can reach the group. */
function HistoryBar({ models }: { models: Models }) {
    const group = useDragGroup();
    const [history] = useState(
        () => new TransferHistory(group, [models.workspace, models.scratch]),
    );
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
                <Undo2 aria-hidden className={styles.buttonIcon} />
                Undo
            </button>
            <button
                type="button"
                className={styles.button}
                disabled={redo.length === 0}
                onClick={() => history.redo()}
            >
                <Redo2 aria-hidden className={styles.buttonIcon} />
                Redo
            </button>
            <p
                role="status"
                data-testid="last-move"
                className={styles.lastMove}
            >
                {last ? (
                    <>
                        {`${last.name}: ${nameOf(last.from.model, models)}`}
                        <ArrowRight
                            aria-hidden
                            className={styles.lastMoveIcon}
                        />
                        {nameOf(last.to.model, models)}
                    </>
                ) : (
                    "Drag a tab from one layout into the other."
                )}
            </p>
            <span className={styles.undoCount}>
                {`${undo.length} move(s) to undo`}
            </span>
        </div>
    );
}

/** A row's child, in either layout: a tabset, or a nested row rendered by this same function. */
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
                            <span className={styles.tabName}>{tab.label}</span>
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

/** Where a dragged tab would land, in either layout. */
function DropIndicator() {
    return (
        <Dockable.DropIndicator
            className={styles.dropIndicator}
            style={(state) => ({
                transitionDuration: `${state.tabDragSpeed}s`,
            })}
        />
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
