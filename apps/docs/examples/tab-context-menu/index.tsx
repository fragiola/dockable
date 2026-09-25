"use client";

import {
    type Action,
    Actions,
    DockableLabel,
    type IJsonModel,
    Model,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { useRef, useState } from "react";
import { ContextMenu } from "@/components/ui/context-menu";
import { Card } from "../_kit/card";
import { TabParts, withTabElement } from "../_kit/custom-tabs";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import { RenameField } from "../_kit/rename-field";
import { useStageTheme } from "../_kit/stage-theme";
import * as styles from "../_kit/styles";

// A Fragiola ContextMenu on every tab. The package provides the actions and the state to decide
// what is available; the menu (and its text) is the consumer's. The tab IS the menu's trigger:
// `render` puts the Dockable.Tab's props onto ContextMenu.Trigger's element.

const json: IJsonModel = {
    global: {
        tabEnableRename: true,
        tabEnablePin: true,
        tabEnablePopout: true,
    },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { type: "tab", name: "Overview", component: "card" },
                    {
                        type: "tab",
                        name: "Settings",
                        component: "card",
                        // not closable: Close is disabled in its menu
                        enableClose: false,
                    },
                    { type: "tab", name: "Activity", component: "card" },
                    { type: "tab", name: "Reports", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { type: "tab", name: "Inbox", component: "card" },
                    { type: "tab", name: "Drafts", component: "card" },
                ],
            },
        ],
    },
};

function MenuTab({
    tab,
    editing,
    setEditing,
}: {
    tab: TabNode;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { engine } = useDockable();
    const [themeRef, theme] = useStageTheme();
    // Rename opens the inline field once the menu has closed and handed focus back to the tab
    const renameOnClose = useRef(false);

    const tabset = tab.getTabContainer();
    const siblings = tabset.getTabNodes();
    const right = siblings.slice(siblings.indexOf(tab) + 1);
    const closable = (nodes: TabNode[]) => nodes.filter((t) => t.isCloseable());
    const others = closable(siblings.filter((t) => t !== tab));
    const toTheRight = closable(right);
    // a tab can live in a border too; maximize is a tabset's
    const maximizable =
        tabset instanceof TabSetNode && tabset.isEnableMaximize();
    const maximized = tabset instanceof TabSetNode && tabset.isMaximized();
    const run = (action: Action) => engine.doAction(action);
    // several closes are one action (and one undo step)
    const closeAll = (nodes: TabNode[]) =>
        run(Actions.group(nodes.map((t) => Actions.deleteTab(t.getId()))));

    return (
        <ContextMenu.Root
            onOpenChangeComplete={(open) => {
                if (!open && renameOnClose.current) {
                    renameOnClose.current = false;
                    setEditing(tab.getId());
                }
            }}
        >
            <Dockable.Tab
                node={tab}
                data-kit-tab=""
                ref={themeRef}
                render={<ContextMenu.Trigger />}
                className={styles.tab}
                // no drag while its name is being edited (text selection in the field)
                draggable={editing ? false : undefined}
            >
                <TabParts tab={tab}>
                    {editing ? (
                        <RenameField
                            name={tab.getName()}
                            onCommit={(name) => {
                                run(Actions.renameTab(tab.getId(), name));
                                setEditing(null);
                            }}
                            onCancel={() => setEditing(null)}
                        />
                    ) : undefined}
                </TabParts>
            </Dockable.Tab>
            <ContextMenu.Content data-example-theme={theme}>
                <ContextMenu.Item
                    disabled={!tab.isCloseable()}
                    onClick={() => run(Actions.deleteTab(tab.getId()))}
                >
                    {label(DockableLabel.Close_Tab)}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={others.length === 0}
                    onClick={() => closeAll(others)}
                >
                    {label(DockableLabel.Menu_Close_Others)}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={toTheRight.length === 0}
                    onClick={() => closeAll(toTheRight)}
                >
                    {label(DockableLabel.Menu_Close_Right)}
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item
                    disabled={!tab.isEnableRename()}
                    onClick={() => {
                        renameOnClose.current = true;
                    }}
                >
                    {label(DockableLabel.Menu_Rename)}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={!tab.isEnablePin()}
                    onClick={() =>
                        run(Actions.setTabPinned(tab.getId(), !tab.isPinned()))
                    }
                >
                    {label(
                        tab.isPinned()
                            ? DockableLabel.Menu_Unpin
                            : DockableLabel.Menu_Pin,
                    )}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={!maximizable}
                    onClick={() =>
                        run(
                            Actions.maximizeToggle(
                                tabset.getId(),
                                tab.getLayoutId(),
                            ),
                        )
                    }
                >
                    {label(
                        maximized
                            ? DockableLabel.Menu_Restore
                            : DockableLabel.Menu_Maximize,
                    )}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={
                        !tab.isEnablePopout() ||
                        !engine.isSupportsPopout() ||
                        tab.isPoppedOut()
                    }
                    onClick={() => run(Actions.popoutTab(tab.getId()))}
                >
                    {label(DockableLabel.Menu_Popout)}
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
}

export default function TabContextMenu() {
    const [model] = useState(() => Model.fromJson(json));
    const [editing, setEditing] = useState<string | null>(null);
    return (
        <DockLayout
            model={model}
            renderTabSet={withTabElement((tab) => (
                <MenuTab
                    tab={tab}
                    editing={editing === tab.getId()}
                    setEditing={setEditing}
                />
            ))}
            renderContent={(tab) => (
                <Card tab={tab}>
                    <p className="text-sm text-palette-accent/85">
                        Right-click a tab (or long-press it) for its menu.
                    </p>
                </Card>
            )}
        />
    );
}
