"use client";

import {
    Actions,
    DockableLabel,
    type IJsonModel,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { Inbox, Lock, X } from "lucide-react";
import { type Ref, useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    // this one has no close button, and ignores middle-click and Ctrl+Delete
                    {
                        type: "tab",
                        name: "Home",
                        component: "card",
                        enableClose: false,
                    },
                    { type: "tab", name: "Report", component: "card" },
                    { type: "tab", name: "Draft", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        // an empty tabset stays, and shows a hint, instead of disappearing
                        enableDeleteWhenEmpty: false,
                        children: [
                            { type: "tab", name: "Inbox", component: "card" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Logs", component: "card" },
                            { type: "tab", name: "Metrics", component: "card" },
                        ],
                    },
                ],
            },
        ],
    },
};

/** A tab with its own close button, closed by a middle click too. */
function ClosableTab({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    // isCloseable() is the tab's `enableClose`, resolved against its tabset and the global
    const closeable = tab.isCloseable();
    const close = () => engine.doAction(Actions.deleteTab(tab.getId()));
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
                {tab.getName()}
            </span>
            {closeable ? (
                <button
                    type="button"
                    // the keyboard closes with Ctrl+Delete on the tab itself (the keyMap's
                    // closeTab), so the button is left out of the tab order
                    tabIndex={-1}
                    aria-label={`${label(DockableLabel.Close_Tab)} ${tab.getName()}`}
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

function CloseTabsetButton({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    if (tabset.getChildren().length === 0) return null;
    return (
        <button
            type="button"
            aria-label={label(DockableLabel.Close_Tabset)}
            className={styles.iconButton}
            // closes every closeable tab; the tabset goes too once it is empty
            onClick={() =>
                engine.doAction(Actions.deleteTabset(tabset.getId()))
            }
        >
            <X aria-hidden className="size-4" />
        </button>
    );
}

function TabSet({ node }: { node: TabSetNode }) {
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
                // `render` gets the element's props and its state ({ empty }). Its `ref` is typed
                // for any HTMLElement, so it is narrowed to a div's here.
                render={(props, state) => (
                    <div {...props} ref={props.ref as Ref<HTMLDivElement>}>
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
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => <Card tab={tab} />}
            renderTabSet={(tabset) => <TabSet node={tabset} />}
        />
    );
}
