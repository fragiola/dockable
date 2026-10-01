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
import { Card } from "../_kit/card";
import { RenameField } from "../_kit/rename-field";
import * as styles from "./styles";

// Inline rename: double-click a tab (or press F2 on it) and type. Enter confirms, Escape cancels,
// an empty name is refused. The package has no rename UI: the name is the app's own data, and
// renaming is the `tab.update` command with the new data. Whether a tab may be renamed is the
// app's too (`renamable` in its data).

// What the layout holds: one component, whose data is the name and the rename permission.
type Types = { tabs: { card: { name: string; renamable?: boolean } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "card", data: { name: "Untitled" } },
                    { component: "card", data: { name: "Sketch" } },
                    {
                        component: "card",
                        // this one cannot be renamed
                        data: { name: "Fixed name", renamable: false },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [{ component: "card", data: { name: "Ideas" } }],
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
                            <Card name={tab.data.name}>
                                <p className={styles.hint}>
                                    Double-click a tab, or focus it and press
                                    F2, to rename it.
                                </p>
                            </Card>
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
                        // the new data is the whole value: keep the rest of it
                        model.run("tab.update", {
                            tabId: tab.id,
                            component: tab.component,
                            data: { ...tab.data, name },
                        });
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
