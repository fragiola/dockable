"use client";

import { createModel, type LayoutJson, type TabOf } from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { TabParts, withTabElement } from "../_kit/custom-tabs";
import { DockLayout } from "../_kit/layout";
import { RenameField } from "../_kit/rename-field";
import * as styles from "../_kit/styles";

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

function RenamableTab({
    tab,
    editing,
    setEditing,
}: {
    tab: TabOf<Types>;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { run } = useDockable<Types>();
    const start = () => {
        if (tab.data.renamable !== false) {
            setEditing(tab.id);
        }
    };
    return (
        <Dockable.Tab
            node={tab}
            data-kit-tab=""
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
            <TabParts tab={tab}>
                {editing ? (
                    <RenameField
                        name={tab.data.name}
                        onCommit={(name) => {
                            // the new data is the whole value: keep the rest of it
                            run("tab.update", {
                                tab: tab.id,
                                component: tab.component,
                                data: { ...tab.data, name },
                            });
                            setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                    />
                ) : undefined}
            </TabParts>
        </Dockable.Tab>
    );
}

export default function RenameTabs() {
    const [model] = useState(() => createModel<Types>(json));
    // one tab at most is being renamed
    const [editing, setEditing] = useState<string | null>(null);
    return (
        <DockLayout
            model={model}
            renderTabSet={withTabElement<Types>((tab) => (
                <RenamableTab
                    tab={tab}
                    editing={editing === tab.id}
                    setEditing={setEditing}
                />
            ))}
            renderContent={(tab) => (
                <Card tab={tab}>
                    <p className="text-sm text-palette-accent/85">
                        Double-click a tab, or focus it and press F2, to rename
                        it.
                    </p>
                </Card>
            )}
        />
    );
}
