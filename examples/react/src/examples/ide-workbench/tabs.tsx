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
import { FileIcon } from "./explorer";
import { editorData, type Types } from "./workspace";

// The workbench's tabset: file tabs with an icon, a dirty dot and a close button, a context
// menu per tab, a Select listing the tabs that no longer fit (tab overflow hides them; the selected
// one always stays), and a maximize button.
// Everything is a consumer choice made of Dockable primitives, commands and data-*.

/** Whether a tab may be closed at all (its `enableClose`, else the layout default). */
function closable(model: Model<Types>, tab: TabOf<Types>) {
    return model.get("tab-settings", { tab: tab.id })?.enableClose === true;
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
                render={<ContextMenu.Trigger />}
                data-dirty={dirty ? "" : undefined}
                className={cn(
                    "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 ps-2.5 pe-1",
                    "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                    "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                    "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                    "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                )}
            >
                <TabIcon tab={tab} />
                <span className="truncate">{tab.data.name}</span>
                {canClose ? (
                    <button
                        type="button"
                        tabIndex={-1}
                        draggable={false}
                        aria-label={`Close ${tab.data.name}`}
                        data-testid="close-tab"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation(); // do not select the tab being closed
                            close();
                        }}
                        className={cn(
                            "grid size-5 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                            "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                        )}
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
                {/* the active tabset's marker: `in-data-active:` reads the enclosing TabSet's
                    data-active, `group-data-selected/tab:` this tab's */}
                <span
                    aria-hidden="true"
                    className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
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
    const { hiddenTabs } = useTabOverflow(node);
    const maximized =
        model.get("maximized-tabset", { layout: layoutId })?.id === node.id;

    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line) data-maximized:shadow-none"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label={node.id === "panel" ? "Panel" : "Editors"}
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => <WorkbenchTab tab={tab} tabset={node} />}
                </Dockable.TabList>
                <div className="flex items-center gap-0.5 pe-1">
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
                            aria-label={`${hiddenTabs.length} more tabs`}
                            data-testid="overflow-select"
                            render={
                                <Select.Trigger className="h-6 min-w-0 gap-1 rounded-sm px-2 py-0 text-xs" />
                            }
                        >
                            {`+${hiddenTabs.length}`}
                        </Dockable.TabOverflowTrigger>
                        <Select.Content>
                            {hiddenTabs.map((tab) => (
                                <Select.Item key={tab.id} value={tab.id}>
                                    {tab.data.name}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                    <button
                        type="button"
                        aria-label={maximized ? "Restore" : "Maximize"}
                        aria-pressed={maximized}
                        onClick={() =>
                            model.run("tabset.maximize", {
                                tabset: node.id,
                                value: !maximized,
                            })
                        }
                        className={cn(
                            "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                            "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                        )}
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
