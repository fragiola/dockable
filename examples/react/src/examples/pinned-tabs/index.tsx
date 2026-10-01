"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import {
    Calendar,
    FileText,
    House,
    type LucideIcon,
    Mail,
    Pin,
    PinOff,
    X,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// Pinned tabs: kept at the start of the strip by the model, shown as icons, and not closable
// (`model.can("tab.close", …)` refuses a pinned tab). The styles read `data-pinned` on the tab.
// Whether a tab offers the pin button is the app's choice: here, `enablePin` in its data.

type Types = {
    tabs: { card: { name: string; icon?: string; enablePin: boolean } };
};

const ICONS: Record<string, LucideIcon> = {
    home: House,
    mail: Mail,
    calendar: Calendar,
};

const tab = (name: string, icon?: string, pinned = false): TabJson<Types> => ({
    component: "card",
    pinned,
    data: { name, enablePin: true, ...(icon ? { icon } : {}) },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    tab("Home", "home", true),
                    tab("Mail", "mail", true),
                    tab("Calendar", "calendar"),
                    tab("Report.pdf"),
                    tab("Budget.xlsx"),
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [tab("Notes"), tab("Drafts")],
            },
        ],
    },
};

export default function PinnedTabs() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Card name={tab.data.name}>
                                <p className={styles.panelText}>
                                    Pin or unpin the selected tab with the pin
                                    button in the header.
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
            </Dockable.Root>
        </div>
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: the strip of tabs and the pin button on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <TabLabel tab={tab} />
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.toolbar}>
                    <PinButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The inside of a tab: an icon when pinned (the name is kept for screen readers). */
function TabLabel({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    const Icon = ICONS[tab.data.icon ?? ""] ?? FileText;
    if (tab.pinned === true) {
        return (
            <>
                <Icon aria-hidden className={styles.tabIcon} />
                <span className={styles.tabNameHidden}>{tab.data.name}</span>
            </>
        );
    }
    return (
        <>
            <span className={styles.tabName}>{tab.data.name}</span>
            {model.can("tab.close", { tabId: tab.id }) ? (
                <button
                    type="button"
                    // the tab is the tab stop; the close button is reached with the mouse
                    // (the keyboard closes with Ctrl+Delete on the tab)
                    tabIndex={-1}
                    aria-label={`Close ${tab.data.name}`}
                    className={styles.closeButton}
                    onClick={(event) => {
                        event.stopPropagation(); // not a click on the tab
                        model.run("tab.close", { tabId: tab.id });
                    }}
                >
                    <X aria-hidden className={styles.closeIcon} />
                </button>
            ) : null}
        </>
    );
}

/** Pins or unpins the tabset's selected tab. */
function PinButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const selected = model.get("selected-tab-by", {
        tabsetId: tabset.id,
    });
    if (!selected?.data.enablePin) {
        return null;
    }
    const pinned = selected.pinned === true;
    return (
        <button
            type="button"
            aria-label={`${pinned ? "Unpin" : "Pin"} ${selected.data.name}`}
            aria-pressed={pinned}
            className={styles.button}
            onClick={() =>
                model.run("tab.pin", { tabId: selected.id, value: !pinned })
            }
        >
            {pinned ? (
                <PinOff aria-hidden className={styles.buttonIcon} />
            ) : (
                <Pin aria-hidden className={styles.buttonIcon} />
            )}
        </button>
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
