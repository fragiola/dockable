"use client";

import {
    type BatchEntry,
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
import { useRef, useState } from "react";
import { ContextMenu } from "#/components/ui/context-menu";
import { Card } from "../_kit/card";
import { RenameField } from "../_kit/rename-field";
import * as styles from "./styles";

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

// the popout host page, served next to the app under its base
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function TabContextMenu() {
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
            <Dockable.Root
                model={model}
                popoutURL={popoutURL}
                // copies <html> and <body>'s attributes (light/dark, the example theme) into each
                // popout window, kept in sync
                popoutMirrorRoot
                className={styles.root}
            >
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
                                    Right-click a tab (or long-press it) for its
                                    menu.
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
                {/* A popped-out tab's window: its own layout, rendered by the same recursion. */}
                <Dockable.Popout<Types> className={styles.popout}>
                    {() => (
                        <>
                            <Dockable.Row<Types>
                                renderSplitter={(props) => (
                                    <Splitter {...props} />
                                )}
                            >
                                {renderNode}
                            </Dockable.Row>
                            {/* a window shows its own outline during a drag into it */}
                            <Dockable.DropIndicator
                                className={styles.dropIndicator}
                                style={(state) => ({
                                    transitionDuration: `${state.tabDragSpeed}s`,
                                })}
                            />
                        </>
                    )}
                </Dockable.Popout>
            </Dockable.Root>
        </div>
    );
}

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
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
                        <MenuTab
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

function MenuTab({
    tab,
    editing,
    setEditing,
}: {
    tab: TabOf<Types>;
    editing: boolean;
    setEditing: (id: string | null) => void;
}) {
    const { model, engine, layoutId } = useDockable<Types>();
    // Rename opens the inline field once the menu has closed and handed focus back to the tab
    const renameOnClose = useRef(false);

    // a tab lives in a tabset or a border; maximize is a tabset's
    const parent = model.get("node-parent-by", { nodeId: tab.id });
    const tabset = parent?.type === "tabset" ? parent : undefined;
    const siblings = parent && parent.type !== "row" ? parent.children : [];
    const right = siblings.slice(
        siblings.findIndex((t) => t.id === tab.id) + 1,
    );
    // what a command would do, asked without applying it (middleware included)
    const closable = (tabs: readonly TabOf<Types>[]) =>
        tabs.filter((t) => model.can("tab.close", { tabId: t.id }));
    const others = closable(siblings.filter((t) => t.id !== tab.id));
    const toTheRight = closable(right);
    const pinned = tab.pinned === true;
    const maximized =
        tabset !== undefined &&
        model.get("maximized-tabset", { layoutId })?.id === tabset.id;
    const rename = (name: string) =>
        model.run("tab.update", {
            tabId: tab.id,
            component: tab.component,
            data: { ...tab.data, name },
        });
    // several closes are one command (one change event, one undo step): all apply or none
    const closeAll = (tabs: readonly TabOf<Types>[]) =>
        model.run("batch", {
            commands: tabs.map(
                (t): BatchEntry<Types> => ({
                    command: "tab.close",
                    payload: { tabId: t.id },
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
                render={<ContextMenu.Trigger />}
                className={styles.tab}
                // no drag while its name is being edited (text selection in the field)
                draggable={editing ? false : undefined}
            >
                {editing ? (
                    <RenameField
                        name={tab.data.name}
                        onCommit={(name) => {
                            rename(name);
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
            <ContextMenu.Content>
                <ContextMenu.Item
                    disabled={!model.can("tab.close", { tabId: tab.id })}
                    onClick={() => model.run("tab.close", { tabId: tab.id })}
                >
                    Close
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={others.length === 0}
                    onClick={() => closeAll(others)}
                >
                    Close others
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={toTheRight.length === 0}
                    onClick={() => closeAll(toTheRight)}
                >
                    Close to the right
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item
                    // renaming is `tab.update` (the name is the tab's data): a middleware may veto it
                    disabled={
                        !model.can("tab.update", {
                            tabId: tab.id,
                            component: tab.component,
                            data: tab.data,
                        })
                    }
                    onClick={() => {
                        renameOnClose.current = true;
                    }}
                >
                    Rename
                </ContextMenu.Item>
                <ContextMenu.Item
                    // refused for a tab in a border (only a tabset has a pinned run)
                    disabled={
                        !model.can("tab.pin", { tabId: tab.id, value: !pinned })
                    }
                    onClick={() =>
                        model.run("tab.pin", { tabId: tab.id, value: !pinned })
                    }
                >
                    {pinned ? "Unpin" : "Pin"}
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={
                        !tabset ||
                        !model.can("tabset.maximize", {
                            tabsetId: tabset.id,
                            value: !maximized,
                        })
                    }
                    onClick={() => {
                        if (tabset) {
                            model.run("tabset.maximize", {
                                tabsetId: tabset.id,
                                value: !maximized,
                            });
                        }
                    }}
                >
                    {maximized ? "Restore tabset" : "Maximize tabset"}
                </ContextMenu.Item>
                <ContextMenu.Item
                    // a screen action: the engine runs `tab.popout` with the tab's place on screen.
                    // Refused when the page cannot open windows, or the tab does not allow
                    // popouts, is pinned or already in a window
                    disabled={!engine.can("popout", { nodeId: tab.id })}
                    onClick={() => engine.run("popout", { nodeId: tab.id })}
                >
                    Pop out
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
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
