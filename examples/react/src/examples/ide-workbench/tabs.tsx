"use client";

import {
    Actions,
    DockableLabel,
    DockLocation,
    type LayoutEngine,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { Bug, Maximize2, Minimize2, SquareTerminal, X } from "lucide-react";
import { useRef } from "react";
import { ContextMenu } from "#/components/ui/context-menu";
import { Select } from "#/components/ui/select";
import { cn } from "#/lib/cn";
import { label } from "../_kit/labels";
import * as styles from "../_kit/styles";
import { usePopupTheme } from "../_kit/theme";
import { FileIcon } from "./explorer";
import { editorConfig } from "./workspace";

// The workbench's tabset: file tabs with an icon, a dirty dot and a close button, a context
// menu per tab, a Select listing the tabs that no longer fit (tab overflow hides them; the selected
// one always stays), and a maximize button.
// Everything is a consumer choice made of Dockable primitives, actions and data-*.

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
    const { hidden } = useTabOverflow(node);
    const popupTheme = usePopupTheme(list);
    const maximized = node.isMaximized();

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
                    {/* the tabs that do not fit, one click away (rendered only while there are some) */}
                    <Select.Root
                        value={null}
                        onValueChange={(id) => {
                            if (typeof id === "string") {
                                engine.doAction(Actions.selectTab(id));
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
                        <Select.Content {...popupTheme}>
                            {hidden.map((tab) => (
                                <Select.Item
                                    key={tab.getId()}
                                    value={tab.getId()}
                                >
                                    {tab.getName()}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
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
                        {node.getChildren().length === 0 ? (
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
