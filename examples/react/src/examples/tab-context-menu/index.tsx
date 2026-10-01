"use client";

import {
    type BatchEntry,
    createModel,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { useRef, useState } from "react";
import { ContextMenu } from "#/components/ui/context-menu";
import { Card } from "../_kit/card";
import { TabParts, withTabElement } from "../_kit/custom-tabs";
import { labels } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import { RenameField } from "../_kit/rename-field";
import * as styles from "../_kit/styles";

// A Fragiola ContextMenu on every tab. The package provides the commands and `model.can`, which
// says whether a command would apply; the menu (and its text) is the consumer's. The tab IS the
// menu's trigger: `render` puts the Dockable.Tab's props onto ContextMenu.Trigger's element.

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may pop out (the built-in default is false)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "Overview" } },
                    {
                        component: "card",
                        data: { name: "Settings" },
                        // not closable: `tab.close` refuses it, so Close is disabled in its menu
                        enableClose: false,
                    },
                    { component: "card", data: { name: "Activity" } },
                    { component: "card", data: { name: "Reports" } },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "card", data: { name: "Inbox" } },
                    { component: "card", data: { name: "Drafts" } },
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
    tab: TabOf<Types>;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { model, run, engine, layoutId } = useDockable<Types>();
    // Rename opens the inline field once the menu has closed and handed focus back to the tab
    const renameOnClose = useRef(false);

    // a tab lives in a tabset or a border; maximize is a tabset's
    const parent = model.parentOf(tab.id);
    const tabset = parent?.type === "tabset" ? parent : undefined;
    const siblings = parent && parent.type !== "row" ? parent.children : [];
    const right = siblings.slice(
        siblings.findIndex((t) => t.id === tab.id) + 1,
    );
    // what a command would do, asked without applying it (middleware included)
    const closable = (tabs: readonly TabOf<Types>[]) =>
        tabs.filter((t) => model.can("tab.close", { tab: t.id }).ok);
    const others = closable(siblings.filter((t) => t.id !== tab.id));
    const toTheRight = closable(right);
    const pinned = tab.pinned === true;
    const maximized =
        tabset !== undefined &&
        model.maximizedTabset(layoutId)?.id === tabset.id;
    const rename = (name: string) =>
        run("tab.update", {
            tab: tab.id,
            component: tab.component,
            data: { ...tab.data, name },
        });
    // several closes are one command (one change event, one undo step): all apply or none
    const closeAll = (tabs: readonly TabOf<Types>[]) =>
        run("batch", {
            commands: tabs.map(
                (t): BatchEntry<Types> => ({
                    command: "tab.close",
                    payload: { tab: t.id },
                }),
            ),
        });

    return (
        <ContextMenu.Root
            onOpenChangeComplete={(open) => {
                if (!open && renameOnClose.current) {
                    renameOnClose.current = false;
                    setEditing(tab.id);
                }
            }}
        >
            <Dockable.Tab
                node={tab}
                data-kit-tab=""
                render={<ContextMenu.Trigger />}
                className={styles.tab}
                // no drag while its name is being edited (text selection in the field)
                draggable={editing ? false : undefined}
            >
                <TabParts tab={tab}>
                    {editing ? (
                        <RenameField
                            name={tab.data.name}
                            onCommit={(name) => {
                                rename(name);
                                setEditing(null);
                            }}
                            onCancel={() => setEditing(null)}
                        />
                    ) : undefined}
                </TabParts>
            </Dockable.Tab>
            <ContextMenu.Content>
                <ContextMenu.Item
                    disabled={!model.can("tab.close", { tab: tab.id }).ok}
                    onClick={() => run("tab.close", { tab: tab.id })}
                >
                    {labels.closeTab}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={others.length === 0}
                    onClick={() => closeAll(others)}
                >
                    {labels.closeOthers}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={toTheRight.length === 0}
                    onClick={() => closeAll(toTheRight)}
                >
                    {labels.closeRight}
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item
                    // renaming is `tab.update` (the name is the tab's data): a middleware may veto it
                    disabled={
                        !model.can("tab.update", {
                            tab: tab.id,
                            component: tab.component,
                            data: tab.data,
                        }).ok
                    }
                    onClick={() => {
                        renameOnClose.current = true;
                    }}
                >
                    {labels.rename}
                </ContextMenu.Item>
                <ContextMenu.Item
                    // refused for a tab in a border (only a tabset has a pinned run)
                    disabled={
                        !model.can("tab.pin", { tab: tab.id, value: !pinned })
                            .ok
                    }
                    onClick={() =>
                        run("tab.pin", { tab: tab.id, value: !pinned })
                    }
                >
                    {pinned ? labels.unpin : labels.pin}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={
                        !tabset ||
                        !model.can("tabset.maximize", {
                            tabset: tabset.id,
                            value: !maximized,
                        }).ok
                    }
                    onClick={() => {
                        if (tabset) {
                            run("tabset.maximize", {
                                tabset: tabset.id,
                                value: !maximized,
                            });
                        }
                    }}
                >
                    {maximized ? labels.restoreTabset : labels.maximizeTabset}
                </ContextMenu.Item>
                <ContextMenu.Item
                    // refused when the tab does not allow popouts, is pinned or already in a
                    // window; whether the page can open windows at all is the engine's to say
                    disabled={
                        !engine.isSupportsPopout() ||
                        !model.can("tab.popout", { tab: tab.id }).ok
                    }
                    onClick={() => run("tab.popout", { tab: tab.id })}
                >
                    {labels.popout}
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
}

export default function TabContextMenu() {
    const [model] = useState(() => createModel<Types>(json));
    const [editing, setEditing] = useState<string | null>(null);
    return (
        <DockLayout
            model={model}
            renderTabSet={withTabElement<Types>((tab) => (
                <MenuTab
                    tab={tab}
                    editing={editing === tab.id}
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
