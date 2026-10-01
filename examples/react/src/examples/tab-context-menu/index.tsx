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
    type DropIndicatorState,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { useRef, useState } from "react";
import { ContextMenu } from "#/components/ui/context-menu";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { RenameField } from "../_kit/rename-field";

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
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                popoutURL={popoutURL}
                // copies <html> and <body>'s attributes (light/dark, the example theme) into each
                // popout window, kept in sync
                popoutMirrorRoot
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
            >
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            // panels sit in a layer above the tabsets, whose overflow cannot clip
                            // them: the panel repeats the tabset's inner radius on its corners
                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                        >
                            <Card name={tab.data.name}>
                                <p className="text-sm text-palette-accent/85">
                                    Right-click a tab (or long-press it) for its
                                    menu.
                                </p>
                            </Card>
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Panels are portalled into the root after the indicator: it needs a stacking
                    order to paint above them. */}
                <Dockable.DropIndicator
                    className={dropIndicatorClass}
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
                {/* A popped-out tab's window: its own layout, rendered by the same recursion. */}
                <Dockable.Popout<Types> className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast">
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
                                className={dropIndicatorClass}
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

/** Where a dragged tab would land: blue into a tabset, orange at a row's edge. */
function dropIndicatorClass(state: DropIndicatorState) {
    return cn(
        "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
        state.kind === "edge"
            ? "palette-orange bg-palette-base/25"
            : "palette-blue bg-palette-base/20",
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
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
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
                render={<ContextMenu.Trigger />}
                className={cn(
                    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                )}
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
                    <span className="truncate">{tab.data.name}</span>
                )}
                {/* the active tabset's marker: `in-data-active:` reads the enclosing TabSet's
                    data-active, `group-data-selected/tab:` this tab's */}
                <span
                    aria-hidden="true"
                    className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                />
            </Dockable.Tab>
            <ContextMenu.Content>
                <ContextMenu.Item
                    disabled={!model.can("tab.close", { tab: tab.id }).ok}
                    onClick={() => run("tab.close", { tab: tab.id })}
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
                            tab: tab.id,
                            component: tab.component,
                            data: tab.data,
                        }).ok
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
                        !model.can("tab.pin", { tab: tab.id, value: !pinned })
                            .ok
                    }
                    onClick={() =>
                        run("tab.pin", { tab: tab.id, value: !pinned })
                    }
                >
                    {pinned ? "Unpin" : "Pin"}
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
                    {maximized ? "Restore tabset" : "Maximize tabset"}
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
                    Pop out
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
}

/**
 * The bar between two children of a row: `--dk-splitter-size` thick (the engine measures it), with
 * a wider grab area (`::after`) and a grip for the themes that show one (`--dk-grip`).
 */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                // side by side: a vertical bar
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                // stacked: a horizontal bar
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}
