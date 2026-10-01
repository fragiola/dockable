"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
    type TabUpdatePayload,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import { RenameField } from "../_kit/rename-field";
import * as styles from "./styles";

// Inline rename: double-click a tab (or press F2 on it) and type. Enter confirms, Escape cancels,
// an empty name is refused. The package has no rename UI: the name is the app's own data, and
// renaming is the `tab.update` command with the new data. Whether a tab may be renamed is the
// app's too (`renamable` in its data).

// What the layout holds: a note, a chart and a KPI, each named in its data, which also says
// whether it may be renamed. The chart's title and the KPI's label are the tab's name: a rename
// shows in the content too.
type Types = {
    tabs: {
        note: { name: string; text: string; renamable?: boolean };
        chart: {
            name: string;
            kind: ChartKind;
            seed: number;
            renamable?: boolean;
        };
        kpi: { name: string; seed: number; renamable?: boolean };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        component: "note",
                        data: {
                            name: "Untitled",
                            text: "Double-click a tab, or focus it and press F2, to rename it.",
                        },
                    },
                    {
                        component: "chart",
                        data: { name: "Sketch", kind: "area", seed: 5 },
                    },
                    {
                        component: "note",
                        // this one cannot be renamed
                        data: {
                            name: "Fixed name",
                            text: "This tab keeps its name: its data says renamable: false.",
                            renamable: false,
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "kpi", data: { name: "Ideas", seed: 12 } },
                ],
            },
        ],
    },
};

/** The `tab.update` that renames a tab: the new data is the whole value, so it keeps the rest. */
function renamed(tab: TabOf<Types>, name: string): TabUpdatePayload<Types> {
    switch (tab.component) {
        case "note":
            return {
                tabId: tab.id,
                component: "note",
                data: { ...tab.data, name },
            };
        case "chart":
            return {
                tabId: tab.id,
                component: "chart",
                data: { ...tab.data, name },
            };
        case "kpi":
            return {
                tabId: tab.id,
                component: "kpi",
                data: { ...tab.data, name },
            };
    }
}

export default function RenameTabs() {
    const [model] = useState(() => createModel<Types>(json));
    // one tab at most is being renamed
    const [editing, setEditing] = useState<string | null>(null);

    /** A row's child: a tabset, or a nested row rendered by this same function. */
    const renderNode = (node: TabsetNode<Types> | RowNode<Types>) =>
        node.type === "row" ? (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        ) : (
            <TabSet node={node} editing={editing} setEditing={setEditing} />
        );

    return (
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
                            {tab.component === "note" ? (
                                <PanelBody title={tab.data.name}>
                                    <p className={styles.hint}>
                                        {tab.data.text}
                                    </p>
                                </PanelBody>
                            ) : tab.component === "chart" ? (
                                <ChartPanel
                                    kind={tab.data.kind}
                                    seed={tab.data.seed}
                                    title={tab.data.name}
                                />
                            ) : (
                                <KpiPanel
                                    label={tab.data.name}
                                    seed={tab.data.seed}
                                />
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
    );
}

/** A tabset: a card with the strip of renamable tabs on top and the measured content area below. */
function TabSet({
    node,
    editing,
    setEditing,
}: {
    node: TabsetNode<Types>;
    /** the tab being renamed (its id) */
    editing: string | null;
    setEditing: (id: string | null) => void;
}) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <RenamableTab
                            tab={tab}
                            editing={editing === tab.id}
                            setEditing={setEditing}
                        />
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

function RenamableTab({
    tab,
    editing,
    setEditing,
}: {
    tab: TabOf<Types>;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { model } = useDockable<Types>();
    const start = () => {
        if (tab.data.renamable !== false) {
            setEditing(tab.id);
        }
    };
    return (
        <Dockable.Tab
            node={tab}
            className={styles.tab}
            onDoubleClick={start}
            onKeyDown={(event) => {
                if (event.key === "F2") {
                    start();
                }
            }}
            // no drag while editing, so the mouse can select text in the field
            draggable={editing ? false : undefined}
        >
            {editing ? (
                <RenameField
                    name={tab.data.name}
                    onCommit={(name) => {
                        model.run("tab.update", renamed(tab, name));
                        setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                />
            ) : (
                <span className={styles.tabName}>{tab.data.name}</span>
            )}
            {/* the active tabset's marker */}
            <span aria-hidden="true" className={styles.tabMarker} />
        </Dockable.Tab>
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
