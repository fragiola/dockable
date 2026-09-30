"use client";

import {
    type ComponentOf,
    DockableLabel,
    MAIN_LAYOUT,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import {
    ChartLine,
    ExternalLink,
    Gauge,
    type LucideIcon,
    Maximize2,
    Minimize2,
    PanelTopClose,
    Sheet,
    TriangleAlert,
    X,
} from "lucide-react";
import { label } from "../_kit/labels";
import * as styles from "../_kit/styles";
import type { Types } from "./data";

// How the dashboard decorates the kit's tabsets: an icon per widget type, a red tab for a KPI
// below target, a close button, and maximize / pop out / dock back buttons in the header.

function isAlert(tab: TabOf<Types>) {
    return tab.component === "kpi" && tab.data.status === "alert";
}

/** The kit's `tabClassName`: a KPI tab below target takes the danger palette. */
export function tabClassName(tab: TabOf<Types>) {
    return isAlert(tab)
        ? "palette-danger text-palette-accent data-selected:text-palette-accent"
        : "";
}

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    chart: ChartLine,
    table: Sheet,
    kpi: Gauge,
};

/** The kit's `renderTab`: what goes inside each tab button. */
export function TabContent({ tab }: { tab: TabOf<Types> }) {
    const { run } = useDockable<Types>();
    const Icon = ICONS[tab.component];
    const alert = isAlert(tab);
    return (
        <>
            {alert ? (
                <TriangleAlert
                    role="img"
                    aria-label="Below target"
                    className="size-3.5 shrink-0"
                />
            ) : (
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            <span data-tab-label className={styles.tabLabel}>
                {tab.data.name}
            </span>
            <button
                type="button"
                tabIndex={-1}
                draggable={false}
                aria-label={`${label(DockableLabel.Close_Tab)} ${tab.data.name}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    run("tab.close", { tab: tab.id });
                }}
                className={`${styles.iconButton} -me-1.5 size-5 opacity-0 group-hover/tab:opacity-100 group-data-selected/tab:opacity-100`}
            >
                <X aria-hidden="true" className="size-3" />
            </button>
        </>
    );
}

/** The kit's `renderActions`: maximize, and pop out (or dock back when already popped out). */
export function TabSetButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, run } = useDockable<Types>();
    const selected = model.selectedTab(tabset.id);
    const inPopout = model.layoutOf(tabset.id) !== MAIN_LAYOUT;
    const maximized = model.maximizedTabset()?.id === tabset.id;

    // one trigger both ways: it pops the selected tab out, and in the window docks it back
    const popoutTrigger = selected ? (
        <Dockable.PopoutTrigger
            aria-label={
                inPopout
                    ? `Dock ${selected.data.name} back`
                    : `${label(DockableLabel.Popout_Tab)} ${selected.data.name}`
            }
            data-testid={inPopout ? "dock-back" : "popout"}
            className={styles.iconButton}
        >
            {inPopout ? (
                <PanelTopClose aria-hidden="true" className="size-4" />
            ) : (
                <ExternalLink aria-hidden="true" className="size-3.5" />
            )}
        </Dockable.PopoutTrigger>
    ) : null;

    if (inPopout) {
        return popoutTrigger;
    }
    return (
        <>
            {popoutTrigger}
            <button
                type="button"
                aria-label={label(
                    maximized ? DockableLabel.Restore : DockableLabel.Maximize,
                )}
                aria-pressed={maximized}
                data-testid="maximize"
                onClick={() =>
                    run("tabset.maximize", {
                        tabset: tabset.id,
                        value: !maximized,
                    })
                }
                className={styles.iconButton}
            >
                {maximized ? (
                    <Minimize2 aria-hidden="true" className="size-3.5" />
                ) : (
                    <Maximize2 aria-hidden="true" className="size-3.5" />
                )}
            </button>
        </>
    );
}
