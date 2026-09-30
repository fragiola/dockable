"use client";

import {
    createModel,
    DockableLabel,
    type LayoutJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { Inbox, Lock, X } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    // this one has no close button, and ignores middle-click and Ctrl+Delete
                    {
                        component: "card",
                        data: { name: "Home" },
                        enableClose: false,
                    },
                    { component: "card", data: { name: "Report" } },
                    { component: "card", data: { name: "Draft" } },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        // an empty tabset stays, and shows a hint, instead of disappearing
                        deleteWhenEmpty: false,
                        children: [
                            { component: "card", data: { name: "Inbox" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Logs" } },
                            { component: "card", data: { name: "Metrics" } },
                        ],
                    },
                ],
            },
        ],
    },
};

/** A tab with its own close button, closed by a middle click too. */
function ClosableTab({ tab }: { tab: TabOf<Types> }) {
    const { model, run } = useDockable<Types>();
    // whether `tab.close` would apply: the tab's `enableClose` (resolved against the layout
    // defaults), not pinned, and no middleware veto. A dry run: nothing changes.
    const closeable = model.can("tab.close", { tab: tab.id }).ok;
    const close = () => run("tab.close", { tab: tab.id });
    return (
        <KitTabButton
            node={tab}
            className="gap-1 pe-1.5"
            onAuxClick={(event) => {
                if (event.button === 1 && closeable) {
                    event.preventDefault();
                    close();
                }
            }}
        >
            <span data-tab-label className={styles.tabLabel}>
                {tab.data.name}
            </span>
            {closeable ? (
                <button
                    type="button"
                    // the keyboard closes with Ctrl+Delete on the tab itself (the keyMap's
                    // closeTab), so the button is left out of the tab order
                    tabIndex={-1}
                    aria-label={`${label(DockableLabel.Close_Tab)} ${tab.data.name}`}
                    className={cn(styles.iconButton, "size-5")}
                    // keep the press from selecting the tab or starting a drag
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        close();
                    }}
                >
                    <X aria-hidden className="size-3.5" />
                </button>
            ) : (
                <Lock
                    aria-hidden
                    className="me-1 size-3 text-palette-accent/85"
                />
            )}
        </KitTabButton>
    );
}

function CloseTabsetButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { run } = useDockable<Types>();
    if (tabset.children.length === 0) return null;
    return (
        <button
            type="button"
            aria-label={label(DockableLabel.Close_Tabset)}
            className={styles.iconButton}
            // closes every closeable tab; the tabset goes too once it is empty
            onClick={() => run("tabset.close", { tabset: tabset.id })}
        >
            <X aria-hidden className="size-4" />
        </button>
    );
}

function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            // an empty tabset is styled from its `data-empty` attribute
            className={cn(
                styles.tabset,
                "data-empty:border-dashed data-empty:bg-palette-soft",
            )}
        >
            <KitTabStrip
                tabset={node}
                actions={<CloseTabsetButton tabset={node} />}
            >
                {(tab) => <ClosableTab tab={tab} />}
            </KitTabStrip>
            <Dockable.TabSetContent
                // No panel covers an empty tabset's content area, so it can show a hint.
                // `render` gets the element's props (its `ref` fits any element) and its state
                // ({ empty }).
                render={(props, state) => (
                    <div {...props}>
                        {state.empty ? (
                            <div className="grid h-full place-content-center justify-items-center gap-2 p-4 text-center text-sm text-palette-accent/85">
                                <Inbox aria-hidden className="size-6" />
                                <p>Nothing open. Drag a tab here.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            />
        </Dockable.TabSet>
    );
}

export default function CloseTabs() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => <Card tab={tab} />}
            renderTabSet={(tabset) => <TabSet node={tabset} />}
        />
    );
}
