"use client";

import {
    Actions,
    DockableLabel,
    type IJsonModel,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
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
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Pinned tabs: kept at the start of the strip by the model, shown as icons, and not closable
// (`isCloseable()` is false for a pinned tab). The styles read `data-pinned` on the tab.

const ICONS: Record<string, LucideIcon> = {
    home: House,
    mail: Mail,
    calendar: Calendar,
};

const tab = (name: string, icon?: string, pinned = false) => ({
    type: "tab",
    name,
    component: "card",
    pinned,
    config: { icon },
});

const json: IJsonModel = {
    global: { tabEnablePin: true },
    borders: [],
    layout: {
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

/** The inside of a tab: an icon when pinned (the name is kept for screen readers). */
function TabLabel({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    const Icon =
        ICONS[(tab.getConfig() as { icon?: string }).icon ?? ""] ?? FileText;
    if (tab.isPinned()) {
        return (
            <>
                <Icon aria-hidden className="size-4" />
                <span className="sr-only">{tab.getName()}</span>
            </>
        );
    }
    return (
        <>
            <span data-tab-label className={styles.tabLabel}>
                {tab.getName()}
            </span>
            {tab.isCloseable() ? (
                <button
                    type="button"
                    // the tab is the tab stop; the close button is reached with the mouse
                    // (the keyboard closes with Ctrl+Delete on the tab)
                    tabIndex={-1}
                    aria-label={`${label(DockableLabel.Close_Tab)} ${tab.getName()}`}
                    className={cn(
                        styles.iconButton,
                        "-me-1.5 size-5 text-current",
                    )}
                    onClick={(event) => {
                        event.stopPropagation(); // not a click on the tab
                        engine.doAction(Actions.deleteTab(tab.getId()));
                    }}
                >
                    <X aria-hidden className="size-3" />
                </button>
            ) : null}
        </>
    );
}

/** Pins or unpins the tabset's selected tab. */
function PinButton({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    const selected = tabset.getSelectedNode() as TabNode | undefined;
    if (!selected?.isEnablePin()) {
        return null;
    }
    const pinned = selected.isPinned();
    return (
        <button
            type="button"
            aria-label={`${label(pinned ? DockableLabel.Menu_Unpin : DockableLabel.Menu_Pin)} ${selected.getName()}`}
            aria-pressed={pinned}
            className={styles.iconButton}
            onClick={() =>
                engine.doAction(Actions.setTabPinned(selected.getId(), !pinned))
            }
        >
            {pinned ? (
                <PinOff aria-hidden className="size-3.5" />
            ) : (
                <Pin aria-hidden className="size-3.5" />
            )}
        </button>
    );
}

export default function PinnedTabs() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderTab={(tab) => <TabLabel tab={tab} />}
            // a pinned tab is a compact icon button; the first unpinned one keeps a gap after them
            tabClassName="data-pinned:px-2 [[data-pinned]+&:not([data-pinned])]:ms-2"
            renderActions={(tabset) => <PinButton tabset={tabset} />}
            renderContent={(tab) => (
                <Card tab={tab}>
                    <p className="text-sm text-palette-accent/85">
                        Pin or unpin the selected tab with the pin button in the
                        header.
                    </p>
                </Card>
            )}
        />
    );
}
