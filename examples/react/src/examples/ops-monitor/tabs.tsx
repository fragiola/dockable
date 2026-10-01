"use client";

import type { ComponentOf, TabOf, TabsetNode } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import {
    Activity,
    BookOpen,
    LayoutDashboard,
    Lock,
    type LucideIcon,
    ScrollText,
} from "lucide-react";

import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";
import * as styles from "../_kit/styles";
import { LEVEL_PALETTE, type Types } from "./panels";

// The console's tabsets. A service tab reads the status its panel wrote into its data and
// shows it three ways: `data-status` (for any stylesheet), a palette (colour) and a badge
// (the number of open alerts). The pinned overview tab is an icon. The incident tabset is
// locked: a lock with a tooltip says so, and `data-locked` lets styles mark it.

export const INCIDENT_TABSET = "incident";

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    overview: LayoutDashboard,
    service: Activity,
    events: ScrollText,
    runbook: BookOpen,
    timeline: ScrollText,
};

function MonitorTab({ tab }: { tab: TabOf<Types> }) {
    // only a service tab has a status: `tab.data` narrows on `tab.component`
    const service = tab.component === "service" ? tab.data : undefined;
    const status = service?.status;
    const palette = status ? LEVEL_PALETTE[status] : "";
    const alerts = service?.alerts ?? 0;
    const Icon = ICONS[tab.component];
    return (
        // The tab's own surface stays the theme's (selected, hover, active). The status colours
        // its icon, a line on top and a badge; `data-status` drives what shows.
        <Dockable.Tab
            node={tab}
            data-kit-tab=""
            data-status={status}
            className={cn(styles.tab, "data-pinned:px-2.5")}
        >
            <Icon
                aria-hidden="true"
                data-testid="tab-icon"
                className={cn(
                    palette,
                    "size-3.5 shrink-0",
                    "group-data-[status=warning]/tab:text-palette-base group-data-[status=critical]/tab:text-palette-base",
                    "motion-safe:group-data-[status=critical]/tab:animate-pulse",
                )}
            />
            {/* a pinned tab is only its icon; the name stays for screen readers */}
            <span
                data-tab-label
                className={cn(styles.tabLabel, tab.pinned && "sr-only")}
            >
                {tab.data.name}
            </span>
            {alerts > 0 ? (
                <span className="sr-only">{`${alerts} open ${alerts === 1 ? "alert" : "alerts"}`}</span>
            ) : null}
            {alerts > 0 ? (
                <span
                    data-testid="alert-count"
                    aria-hidden="true"
                    className={cn(
                        palette,
                        "grid h-4 min-w-4 place-items-center rounded-full bg-palette-base px-1 font-sans text-[10px] font-semibold text-palette-contrast tabular-nums",
                    )}
                >
                    {alerts}
                </span>
            ) : null}
            <span
                aria-hidden="true"
                className={cn(
                    palette,
                    "pointer-events-none absolute inset-x-0 top-0 hidden h-0.5 bg-palette-base",
                    "group-data-[status=warning]/tab:block group-data-[status=critical]/tab:block",
                )}
            />
            <span
                aria-hidden="true"
                data-tab-marker
                className={styles.tabMarker}
            />
        </Dockable.Tab>
    );
}

export function MonitorTabSet({ node }: { node: TabsetNode<Types> }) {
    const locked = node.id === INCIDENT_TABSET;
    return (
        <Dockable.TabSet
            node={node}
            data-kit-tabset=""
            data-locked={locked ? "" : undefined}
            className={cn(styles.tabset, "data-locked:border-dashed")}
        >
            <div className={styles.tabsetHeader}>
                <Dockable.TabList<Types>
                    data-kit-tablist=""
                    aria-label={locked ? "Incident" : "Monitors"}
                    className={styles.tabList}
                >
                    {(tab) => <MonitorTab tab={tab} />}
                </Dockable.TabList>
                {locked ? (
                    <div className={styles.tabsetActions}>
                        <Tooltip.Root>
                            <Tooltip.Trigger
                                aria-label="Locked region"
                                className={styles.iconButton}
                            >
                                <Lock aria-hidden="true" className="size-3.5" />
                            </Tooltip.Trigger>
                            <Tooltip.Content className="palette-surface">
                                Locked: only incident tabs can be dropped here
                            </Tooltip.Content>
                        </Tooltip.Root>
                    </div>
                ) : null}
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}
