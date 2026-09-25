"use client";

import {
    Actions,
    DockableLabel,
    DockLocation,
    type LayoutEngine,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { Bug, Maximize2, Minimize2, SquareTerminal, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { ContextMenu } from "@/components/ui/context-menu";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { label } from "../_kit/labels";
import * as styles from "../_kit/styles";
import { usePopupTheme } from "../_kit/theme";
import { FileIcon } from "./explorer";
import { editorConfig } from "./workspace";

// The workbench's tabset: file tabs with an icon, a dirty dot and a close button, a context
// menu per tab, a Select listing every tab when they no longer fit, and a maximize button.
// Everything is a consumer choice made of Dockable primitives, actions and data-*.

/** True while the tab list's content is wider than the list. */
function useOverflow(ref: RefObject<HTMLElement | null>, tabCount: number) {
    const [overflowing, setOverflowing] = useState(false);
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when tabs come and go
    useEffect(() => {
        const list = ref.current;
        if (!list) return;
        const measure = () =>
            setOverflowing(list.scrollWidth > list.clientWidth + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(list);
        return () => observer.disconnect();
    }, [ref, tabCount]);
    return overflowing;
}

/** Scrolls the strip so the selected tab is in view (the strip clips, it does not wrap). */
function useSelectedInView(
    ref: RefObject<HTMLElement | null>,
    selectedId: string | undefined,
) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the selection changes
    useEffect(() => {
        const list = ref.current;
        const tab = list?.querySelector<HTMLElement>("[data-selected]");
        if (!list || !tab) return;
        const outer = list.getBoundingClientRect();
        const inner = tab.getBoundingClientRect();
        if (inner.left < outer.left) list.scrollLeft -= outer.left - inner.left;
        else if (inner.right > outer.right)
            list.scrollLeft += inner.right - outer.right;
    }, [ref, selectedId]);
}

function closeAll(engine: LayoutEngine, tabs: TabNode[]) {
    for (const tab of tabs) {
        if (tab.isEnableClose()) {
            // one action per tab: onAction can still stop the dirty ones
            engine.doAction(Actions.deleteTab(tab.getId()));
        }
    }
}

function TabIcon({ tab }: { tab: TabNode }) {
    const config = editorConfig(tab);
    if (config) return <FileIcon path={config.path} />;
    const Icon = tab.getComponent() === "terminal" ? SquareTerminal : Bug;
    return <Icon aria-hidden="true" className="size-3.5 shrink-0" />;
}

function WorkbenchTab({
    tab,
    popupTheme,
}: {
    tab: TabNode;
    popupTheme: ReturnType<typeof usePopupTheme>;
}) {
    const { engine } = useDockable();
    const tabset = tab.getParent() as TabSetNode;
    const siblings = tabset.getChildren() as TabNode[];
    const index = siblings.indexOf(tab);
    const dirty = editorConfig(tab)?.dirty === true;
    const close = () => engine.doAction(Actions.deleteTab(tab.getId()));

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
                    {tab.getName()}
                </span>
                {tab.isEnableClose() ? (
                    <button
                        type="button"
                        tabIndex={-1}
                        draggable={false}
                        aria-label={`${label(DockableLabel.Close_Tab)} ${tab.getName()}`}
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
            <ContextMenu.Content {...popupTheme}>
                <ContextMenu.Item
                    disabled={!tab.isEnableClose()}
                    onClick={close}
                >
                    Close
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={siblings.length < 2}
                    onClick={() =>
                        closeAll(
                            engine,
                            siblings.filter((other) => other !== tab),
                        )
                    }
                >
                    Close others
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={index === siblings.length - 1}
                    onClick={() => closeAll(engine, siblings.slice(index + 1))}
                >
                    Close to the right
                </ContextMenu.Item>
                <ContextMenu.Item
                    onClick={() =>
                        closeAll(
                            engine,
                            siblings.filter(
                                (other) => editorConfig(other)?.dirty !== true,
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
                        engine.doAction(
                            Actions.moveNode(
                                tab.getId(),
                                tabset.getId(),
                                DockLocation.RIGHT,
                                -1,
                            ),
                        )
                    }
                >
                    Split right
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={siblings.length < 2}
                    onClick={() =>
                        engine.doAction(
                            Actions.moveNode(
                                tab.getId(),
                                tabset.getId(),
                                DockLocation.BOTTOM,
                                -1,
                            ),
                        )
                    }
                >
                    Split down
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
}

export function WorkbenchTabSet({ node }: { node: TabSetNode }) {
    const { engine } = useDockable();
    const list = useRef<HTMLDivElement | null>(null);
    const tabs = node.getChildren() as TabNode[];
    const selected = node.getSelectedNode() as TabNode | undefined;
    const overflowing = useOverflow(list, tabs.length);
    const popupTheme = usePopupTheme(list);
    const maximized = node.isMaximized();
    useSelectedInView(list, selected?.getId());

    return (
        <Dockable.TabSet
            node={node}
            data-kit-tabset=""
            className={cn(styles.tabset, "data-maximized:shadow-none")}
        >
            <div className={styles.tabsetHeader}>
                <Dockable.TabList
                    data-kit-tablist=""
                    ref={list}
                    aria-label={node.getId() === "panel" ? "Panel" : "Editors"}
                    className={styles.tabList}
                >
                    {(tab) => (
                        <WorkbenchTab tab={tab} popupTheme={popupTheme} />
                    )}
                </Dockable.TabList>
                <div className={styles.tabsetActions}>
                    {/* the strip clips its tabs; when it does, every tab is one click away */}
                    {overflowing ? (
                        <Select.Root
                            value={selected?.getId() ?? null}
                            items={tabs.map((tab) => ({
                                value: tab.getId(),
                                label: tab.getName(),
                            }))}
                            onValueChange={(id) => {
                                if (typeof id === "string") {
                                    engine.doAction(Actions.selectTab(id));
                                }
                            }}
                        >
                            <Select.Trigger
                                aria-label="Open tabs"
                                data-testid="overflow-select"
                                className="h-6 max-w-36 min-w-0 gap-1 rounded-sm px-2 py-0 text-xs"
                            >
                                <Select.Value className="truncate text-xs" />
                            </Select.Trigger>
                            <Select.Content {...popupTheme}>
                                {tabs.map((tab) => (
                                    <Select.Item
                                        key={tab.getId()}
                                        value={tab.getId()}
                                    >
                                        {tab.getName()}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    ) : null}
                    <button
                        type="button"
                        aria-label={label(
                            maximized
                                ? DockableLabel.Restore
                                : DockableLabel.Maximize,
                        )}
                        aria-pressed={maximized}
                        onClick={() =>
                            engine.doAction(
                                Actions.maximizeToggle(node.getId()),
                            )
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
                        {tabs.length === 0 ? (
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
