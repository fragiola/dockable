"use client";

import {
    createModel,
    DockableLabel,
    type LayoutJson,
    type TabJson,
    type TabOf,
    type TabsetNode,
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
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";
import { label } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

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

/** The inside of a tab: an icon when pinned (the name is kept for screen readers). */
function TabLabel({ tab }: { tab: TabOf<Types> }) {
    const { model, run } = useDockable<Types>();
    const Icon = ICONS[tab.data.icon ?? ""] ?? FileText;
    if (tab.pinned === true) {
        return (
            <>
                <Icon aria-hidden className="size-4" />
                <span className="sr-only">{tab.data.name}</span>
            </>
        );
    }
    return (
        <>
            <span data-tab-label className={styles.tabLabel}>
                {tab.data.name}
            </span>
            {model.can("tab.close", { tab: tab.id }).ok ? (
                <button
                    type="button"
                    // the tab is the tab stop; the close button is reached with the mouse
                    // (the keyboard closes with Ctrl+Delete on the tab)
                    tabIndex={-1}
                    aria-label={`${label(DockableLabel.Close_Tab)} ${tab.data.name}`}
                    className={cn(
                        styles.iconButton,
                        "-me-1.5 size-5 text-current",
                    )}
                    onClick={(event) => {
                        event.stopPropagation(); // not a click on the tab
                        run("tab.close", { tab: tab.id });
                    }}
                >
                    <X aria-hidden className="size-3" />
                </button>
            ) : null}
        </>
    );
}

/** Pins or unpins the tabset's selected tab. */
function PinButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, run } = useDockable<Types>();
    const selected = model.selectedTab(tabset.id);
    if (!selected?.data.enablePin) {
        return null;
    }
    const pinned = selected.pinned === true;
    return (
        <button
            type="button"
            aria-label={`${label(pinned ? DockableLabel.Menu_Unpin : DockableLabel.Menu_Pin)} ${selected.data.name}`}
            aria-pressed={pinned}
            className={styles.iconButton}
            onClick={() => run("tab.pin", { tab: selected.id, value: !pinned })}
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
    const [model] = useState(() => createModel<Types>(json));
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
