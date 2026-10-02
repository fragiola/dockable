"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
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
// an empty name is refused. The package has no rename UI: the name is the tab's `label`, and
// renaming is one command, `tab.configure` with the new label, whatever the tab's component.
// Whether a tab may be renamed is the app's choice (`renamable` in its data).

// What the layout holds: a note, a chart and a KPI. A note's data may say it keeps its name.
// The chart's title and the KPI's caption are the tab's label: a rename shows in the content too.
type Types = {
    tabs: {
        note: { text: string; renamable?: boolean };
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
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
                        label: "Untitled",
                        data: {
                            text: "Double-click a tab, or focus it and press F2, to rename it.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Sketch",
                        data: { kind: "area", seed: 5 },
                    },
                    {
                        component: "note",
                        label: "Fixed name",
                        // this one cannot be renamed
                        data: {
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
                    { component: "kpi", label: "Ideas", data: { seed: 12 } },
                ],
            },
        ],
    },
};

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
                            <Content tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
            </Dockable.Root>
        </div>
    );
}

function Content({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "note":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.hint}>{tab.data.text}</p>
                </PanelBody>
            );
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.data.seed}
                    title={tab.label}
                />
            );
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
    }
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
        if (tab.component !== "note" || tab.data.renamable !== false) {
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
                    name={tab.label}
                    onCommit={(name) => {
                        model.run("tab.configure", {
                            tabId: tab.id,
                            label: name,
                        });
                        setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                />
            ) : (
                <span className={styles.tabName}>{tab.label}</span>
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
