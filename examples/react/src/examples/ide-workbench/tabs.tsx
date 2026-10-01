"use client";

import type { Model, TabOf, TabsetNode } from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { Bug, Maximize2, Minimize2, SquareTerminal, X } from "lucide-react";

import { ContextMenu } from "#/components/ui/context-menu";
import { Select } from "#/components/ui/select";
import { cn } from "#/lib/cn";
import { labels } from "../_kit/labels";
import * as styles from "../_kit/styles";
import { FileIcon } from "./explorer";
import { editorData, type Types } from "./workspace";

// The workbench's tabset: file tabs with an icon, a dirty dot and a close button, a context
// menu per tab, a Select listing the tabs that no longer fit (tab overflow hides them; the selected
// one always stays), and a maximize button.
// Everything is a consumer choice made of Dockable primitives, commands and data-*.

/** Whether a tab may be closed at all (its `enableClose`, else the layout default). */
function closable(model: Model<Types>, tab: TabOf<Types>) {
    return model.resolve(tab).enableClose;
}

function closeAll(model: Model<Types>, tabs: readonly TabOf<Types>[]) {
    for (const tab of tabs) {
        if (closable(model, tab)) {
            // one command per tab: the workbench's middleware can still stop the dirty ones
            model.run("tab.close", { tab: tab.id });
        }
    }
}

function TabIcon({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "editor":
            return <FileIcon path={tab.data.path} />;
        case "terminal":
            return (
                <SquareTerminal
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                />
            );
        default:
            return <Bug aria-hidden="true" className="size-3.5 shrink-0" />;
    }
}

function WorkbenchTab({
    tab,
    tabset,
}: {
    tab: TabOf<Types>;
    tabset: TabsetNode<Types>;
}) {
    const { model } = useDockable<Types>();
    const siblings = tabset.children;
    const index = siblings.findIndex((other) => other.id === tab.id);
    const dirty = editorData(tab)?.dirty === true;
    const canClose = closable(model, tab);
    const close = () => model.run("tab.close", { tab: tab.id });

    return (
        <ContextMenu.Root>
            {/* `render` makes the context menu trigger the tab itself, with the tab's props */}
            <Dockable.Tab
                node={tab}
                data-kit-tab=""
                render={<ContextMenu.Trigger />}
                data-dirty={dirty ? "" : undefined}
                className={cn(styles.tab, "gap-1.5 ps-2.5 pe-1")}
            >
                <TabIcon tab={tab} />
                <span data-tab-label className={styles.tabLabel}>
                    {tab.data.name}
                </span>
                {canClose ? (
                    <button
                        type="button"
                        tabIndex={-1}
                        draggable={false}
                        aria-label={`${labels.closeTab} ${tab.data.name}`}
                        data-testid="close-tab"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation(); // do not select the tab being closed
                            close();
                        }}
                        className={cn(styles.iconButton, "size-5")}
                    >
                        {/* VS Code's convention: a dot while modified, the cross on hover */}
                        {dirty ? (
                            <span
                                data-testid="dirty-dot"
                                className="size-2 rounded-full bg-palette-contrast group-hover/tab:hidden"
                            />
                        ) : null}
                        <X
                            aria-hidden="true"
                            className={cn(
                                "size-3.5",
                                dirty
                                    ? "hidden group-hover/tab:block"
                                    : "opacity-0 group-hover/tab:opacity-100 group-data-selected/tab:opacity-100",
                            )}
                        />
                    </button>
                ) : null}
                <span
                    aria-hidden="true"
                    data-tab-marker
                    className={styles.tabMarker}
                />
            </Dockable.Tab>
            <ContextMenu.Content>
                <ContextMenu.Item disabled={!canClose} onClick={close}>
                    Close
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={siblings.length < 2}
                    onClick={() =>
                        closeAll(
                            model,
                            siblings.filter((other) => other.id !== tab.id),
                        )
                    }
                >
                    Close others
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={index === siblings.length - 1}
                    onClick={() => closeAll(model, siblings.slice(index + 1))}
                >
                    Close to the right
                </ContextMenu.Item>
                <ContextMenu.Item
                    onClick={() =>
                        closeAll(
                            model,
                            siblings.filter(
                                (other) => editorData(other)?.dirty !== true,
                            ),
                        )
                    }
                >
                    Close saved
                </ContextMenu.Item>
                <ContextMenu.Separator />
                {/* moving a tab to its own tabset's edge splits it off into a new tabset */}
                <ContextMenu.Item
                    disabled={siblings.length < 2}
                    onClick={() =>
                        model.run("tab.move", {
                            tab: tab.id,
                            to: tabset.id,
                            location: "right",
                        })
                    }
                >
                    Split right
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={siblings.length < 2}
                    onClick={() =>
                        model.run("tab.move", {
                            tab: tab.id,
                            to: tabset.id,
                            location: "bottom",
                        })
                    }
                >
                    Split down
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
}

export function WorkbenchTabSet({ node }: { node: TabsetNode<Types> }) {
    const { model, layoutId } = useDockable<Types>();
    const { hidden } = useTabOverflow(node);
    const maximized = model.maximizedTabset(layoutId)?.id === node.id;

    return (
        <Dockable.TabSet
            node={node}
            data-kit-tabset=""
            className={cn(styles.tabset, "data-maximized:shadow-none")}
        >
            <div className={styles.tabsetHeader}>
                <Dockable.TabList<Types>
                    data-kit-tablist=""
                    aria-label={node.id === "panel" ? "Panel" : "Editors"}
                    className={styles.tabList}
                >
                    {(tab) => <WorkbenchTab tab={tab} tabset={node} />}
                </Dockable.TabList>
                <div className={styles.tabsetActions}>
                    {/* the tabs that do not fit, one click away (rendered only while there are some) */}
                    <Select.Root
                        value={null}
                        onValueChange={(id) => {
                            if (typeof id === "string") {
                                model.run("tab.select", { tab: id });
                            }
                        }}
                    >
                        <Dockable.TabOverflowTrigger
                            aria-label={`${hidden.length} more tabs`}
                            data-testid="overflow-select"
                            render={
                                <Select.Trigger className="h-6 min-w-0 gap-1 rounded-sm px-2 py-0 text-xs" />
                            }
                        >
                            {`+${hidden.length}`}
                        </Dockable.TabOverflowTrigger>
                        <Select.Content>
                            {hidden.map((tab) => (
                                <Select.Item key={tab.id} value={tab.id}>
                                    {tab.data.name}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                    <button
                        type="button"
                        aria-label={
                            maximized ? labels.restore : labels.maximize
                        }
                        aria-pressed={maximized}
                        onClick={() =>
                            model.run("tabset.maximize", {
                                tabset: node.id,
                                value: !maximized,
                            })
                        }
                        className={styles.iconButton}
                    >
                        {maximized ? (
                            <Minimize2
                                aria-hidden="true"
                                className="size-3.5"
                            />
                        ) : (
                            <Maximize2
                                aria-hidden="true"
                                className="size-3.5"
                            />
                        )}
                    </button>
                </div>
            </div>
            {/* the content area renders nothing of its own: `render` adds the empty state */}
            <Dockable.TabSetContent
                render={
                    <div>
                        {node.children.length === 0 ? (
                            <p className="grid h-full place-items-center p-4 text-center text-sm text-palette-accent/85">
                                Open a file from the explorer.
                            </p>
                        ) : null}
                    </div>
                }
            />
        </Dockable.TabSet>
    );
}
