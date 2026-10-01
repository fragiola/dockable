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
            data-status={status}
            className={cn(
                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                // a pinned tab is only its icon: a narrower button
                "data-pinned:px-2.5",
            )}
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
            <span className={cn("truncate", tab.pinned && "sr-only")}>
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
            {/* the active tabset's marker: `in-data-active:` reads the enclosing TabSet's
                data-active, `group-data-selected/tab:` this tab's */}
            <span
                aria-hidden="true"
                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
            />
        </Dockable.Tab>
    );
}

export function MonitorTabSet({ node }: { node: TabsetNode<Types> }) {
    const locked = node.id === INCIDENT_TABSET;
    return (
        <Dockable.TabSet
            node={node}
            data-locked={locked ? "" : undefined}
            className={cn(
                "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
                "data-locked:border-dashed",
            )}
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label={locked ? "Incident" : "Monitors"}
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => <MonitorTab tab={tab} />}
                </Dockable.TabList>
                {locked ? (
                    <div className="flex items-center gap-0.5 pe-1">
                        <Tooltip.Root>
                            <Tooltip.Trigger
                                aria-label="Locked region"
                                className={cn(
                                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                                    "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                                    "disabled:pointer-events-none disabled:opacity-40",
                                )}
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
