"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// Maximize a tabset three ways: its header button, a double-click on the empty part of its strip,
// and Escape to restore. The styles read `data-maximized` (on the tabset and on the root); the
// splitters hide themselves while a tabset is maximized.

// What the layout holds: three components, each named by its label.
type Types = {
    tabs: {
        chart: undefined;
        bars: undefined;
        table: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "chart", label: "Revenue" },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "bars", label: "Signups" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Latest" }],
                    },
                ],
            },
        ],
    },
};

export default function Maximize() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
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
                <RestoreOnEscape />
            </Dockable.Root>
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

/**
 * A tabset: the strip and its maximize button on top, the measured content area below. The
 * maximized tabset is outlined and its header highlighted; a double-click on the header (not on
 * a tab or a button) toggles.
 */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    const { model, layoutId } = useDockable<Types>();
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a mouse shortcut; the button is the accessible way */}
            <div
                className={styles.strip}
                onDoubleClick={(event) => {
                    const target = event.target as Element;
                    if (
                        !target.closest('[role="tab"], button') &&
                        canMaximize(model, node)
                    ) {
                        model.run("tabset.maximize", {
                            tabsetId: node.id,
                            value:
                                model.get("maximized-tabset", {
                                    layoutId,
                                })?.id !== node.id,
                        });
                    }
                }}
            >
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
                <div className={styles.toolbar}>
                    <MaximizeButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A tab's content: `tab.data` and the component narrow together. */
function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "chart":
            return <ChartPanel kind="area" seed={3} />;
        case "bars":
            return <ChartPanel kind="bar" seed={19} />;
        case "table":
            return <TablePanel />;
    }
}

/** Whether the tabset may be maximized: the model answers without running the command. */
function canMaximize(model: Model<Types>, tabset: TabsetNode<Types>) {
    return model.can("tabset.maximize", { tabsetId: tabset.id, value: true });
}

function MaximizeButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, layoutId } = useDockable<Types>();
    const maximized =
        model.get("maximized-tabset", { layoutId })?.id === tabset.id;
    if (!canMaximize(model, tabset)) {
        return null;
    }
    return (
        <button
            type="button"
            aria-label={maximized ? "Restore" : "Maximize"}
            aria-pressed={maximized}
            className={styles.button}
            onClick={() =>
                model.run("tabset.maximize", {
                    tabsetId: tabset.id,
                    value: !maximized,
                })
            }
        >
            {maximized ? (
                <Minimize2 aria-hidden className={styles.buttonIcon} />
            ) : (
                <Maximize2 aria-hidden className={styles.buttonIcon} />
            )}
        </button>
    );
}

/** Escape restores the maximized tabset, from anywhere in the page. */
function RestoreOnEscape() {
    const { engine, model, layoutId } = useDockable<Types>();
    useEffect(() => {
        const doc = engine.get("owner-document");
        if (!doc) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            const maximized = model.get("maximized-tabset", {
                layoutId,
            });
            if (
                event.key === "Escape" &&
                !event.defaultPrevented &&
                maximized
            ) {
                model.run("tabset.maximize", {
                    tabsetId: maximized.id,
                    value: false,
                });
            }
        };
        doc.addEventListener("keydown", onKeyDown);
        return () => doc.removeEventListener("keydown", onKeyDown);
    }, [engine, model, layoutId]);
    return null;
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
