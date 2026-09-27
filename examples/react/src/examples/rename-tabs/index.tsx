"use client";

import {
    Actions,
    type IJsonModel,
    Model,
    type TabNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { TabParts, withTabElement } from "../_kit/custom-tabs";
import { DockLayout } from "../_kit/layout";
import { RenameField } from "../_kit/rename-field";
import * as styles from "../_kit/styles";

// Inline rename: double-click a tab (or press F2 on it) and type. Enter confirms, Escape cancels,
// an empty name is refused. The package has no rename UI; it has `Actions.renameTab` and the
// `enableRename` flag.

const json: IJsonModel = {
    global: { tabEnableRename: true },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { type: "tab", name: "Untitled", component: "card" },
                    { type: "tab", name: "Sketch", component: "card" },
                    {
                        type: "tab",
                        name: "Fixed name",
                        component: "card",
                        // this one cannot be renamed
                        enableRename: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [{ type: "tab", name: "Ideas", component: "card" }],
            },
        ],
    },
};

function RenamableTab({
    tab,
    editing,
    setEditing,
}: {
    tab: TabNode;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { engine } = useDockable();
    const start = () => {
        if (tab.isEnableRename()) {
            setEditing(tab.getId());
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
                        name={tab.getName()}
                        onCommit={(name) => {
                            engine.doAction(
                                Actions.renameTab(tab.getId(), name),
                            );
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
    const [model] = useState(() => Model.fromJson(json));
    // one tab at most is being renamed
    const [editing, setEditing] = useState<string | null>(null);
    return (
        <DockLayout
            model={model}
            renderTabSet={withTabElement((tab) => (
                <RenamableTab
                    tab={tab}
                    editing={editing === tab.getId()}
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
