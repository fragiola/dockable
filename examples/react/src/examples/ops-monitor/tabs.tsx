"use client";

import {
    type ComponentOf,
    Dockable,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-react";
import {
    Activity,
    BookOpen,
    LayoutDashboard,
    Lock,
    type LucideIcon,
    ScrollText,
} from "lucide-react";

import { Tooltip } from "#/components/ui/tooltip";
import type { Types } from "./panels";
import * as styles from "./styles";

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
    const alerts = service?.alerts ?? 0;
    const Icon = ICONS[tab.component];
    return (
        // `data-status` drives what shows: the status colours the icon, a line on top and a badge.
        <Dockable.Tab node={tab} data-status={status} className={styles.tab}>
            <Icon
                aria-hidden="true"
                data-testid="tab-icon"
                className={styles.tabIcon(status)}
            />
            {/* a pinned tab is only its icon; the name stays for screen readers */}
            <span className={styles.tabName(tab.pinned)}>{tab.label}</span>
            {alerts > 0 ? (
                <span className={styles.alertsLabel}>
                    {`${alerts} open ${alerts === 1 ? "alert" : "alerts"}`}
                </span>
            ) : null}
            {alerts > 0 ? (
                <span
                    data-testid="alert-count"
                    aria-hidden="true"
                    className={styles.alertBadge(status)}
                >
                    {alerts}
                </span>
            ) : null}
            <span aria-hidden="true" className={styles.statusLine(status)} />
        </Dockable.Tab>
    );
}

export function MonitorTabSet({ node }: { node: TabsetNode<Types> }) {
    const locked = node.id === INCIDENT_TABSET;
    return (
        <Dockable.TabSet
            node={node}
            data-locked={locked ? "" : undefined}
            className={styles.tabset}
        >
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label={locked ? "Incident" : "Monitors"}
                    className={styles.tabList}
                >
                    {(tab) => <MonitorTab tab={tab} />}
                </Dockable.TabList>
                {locked ? (
                    <div className={styles.tabsetButtons}>
                        <Tooltip.Root>
                            <Tooltip.Trigger
                                aria-label="Locked region"
                                className={styles.lockButton}
                            >
                                <Lock
                                    aria-hidden="true"
                                    className={styles.lockIcon}
                                />
                            </Tooltip.Trigger>
                            <Tooltip.Content className={styles.tooltip}>
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
