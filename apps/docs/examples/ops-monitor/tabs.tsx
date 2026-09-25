"use client";

import type { TabNode, TabSetNode } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import {
    Activity,
    BookOpen,
    LayoutDashboard,
    Lock,
    ScrollText,
} from "lucide-react";
import { useRef } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import * as styles from "../_kit/styles";
import { usePopupTheme } from "../_kit/theme";
import { LEVEL_PALETTE, type ServiceConfig } from "./panels";

// The console's tabsets. A service tab reads the status its panel wrote into its config and
// shows it three ways: `data-status` (for any stylesheet), a palette (colour) and a badge
// (the number of open alerts). The pinned overview tab is an icon. The incident tabset is
// locked: a lock with a tooltip says so, and `data-locked` lets styles mark it.

export const INCIDENT_TABSET = "incident";

const ICONS: Record<string, typeof Activity> = {
    overview: LayoutDashboard,
    service: Activity,
    events: ScrollText,
    runbook: BookOpen,
    timeline: ScrollText,
};

function MonitorTab({ tab }: { tab: TabNode }) {
    const config = tab.getConfig() as ServiceConfig | undefined;
    const status =
        tab.getComponent() === "service" ? config?.status : undefined;
    const palette = status ? LEVEL_PALETTE[status] : "";
    const alerts = config?.alerts ?? 0;
    const Icon = ICONS[tab.getComponent() ?? ""] ?? Activity;
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
                className={cn(styles.tabLabel, tab.isPinned() && "sr-only")}
            >
                {tab.getName()}
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

export function MonitorTabSet({ node }: { node: TabSetNode }) {
    const locked = node.getId() === INCIDENT_TABSET;
    const header = useRef<HTMLDivElement | null>(null);
    const popupTheme = usePopupTheme(header);
    return (
        <Dockable.TabSet
            node={node}
            data-kit-tabset=""
            data-locked={locked ? "" : undefined}
            className={cn(styles.tabset, "data-locked:border-dashed")}
        >
            <div ref={header} className={styles.tabsetHeader}>
                <Dockable.TabList
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
                            <Tooltip.Content
                                className="palette-surface"
                                {...popupTheme}
                            >
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
