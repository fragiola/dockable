import { Component, computed, input } from "@angular/core";
import {
    type ComponentOf,
    DOCKABLE,
    injectDockable,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideActivity,
    LucideBookOpen,
    LucideDynamicIcon,
    type LucideIcon,
    LucideLayoutDashboard,
    LucideLock,
    LucideScrollText,
} from "@lucide/angular";
import { TOOLTIP } from "#/components/ui/tooltip";
import type { Types } from "./panels";
import * as styles from "./styles";

// The console's tabsets. A service tab reads the status its panel wrote into its data and
// shows it three ways: `data-status` (for any stylesheet), a palette (colour) and a badge
// (the number of open alerts). The pinned overview tab is an icon. The incident tabset is
// locked: a lock with a tooltip says so, and `data-locked` lets styles mark it.

export const INCIDENT_TABSET = "incident";

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    overview: LucideLayoutDashboard,
    service: LucideActivity,
    events: LucideScrollText,
    runbook: LucideBookOpen,
    timeline: LucideScrollText,
};

/** Only a service tab has a status: `tab.data` narrows on `tab.component`. */
function serviceOf(tab: TabOf<Types>) {
    return tab.component === "service" ? tab.data : undefined;
}

@Component({
    selector: "example-ops-monitor-tabset",
    imports: [DOCKABLE, TOOLTIP, LucideDynamicIcon, LucideLock],
    host: { class: "contents" },
    template: `
        <div
            [dockableTabSet]="node()"
            [attr.data-locked]="locked() ? '' : null"
            [class]="styles.tabset"
        >
            <div [class]="styles.strip">
                <div
                    dockableTabList
                    [attr.aria-label]="locked() ? 'Incident' : 'Monitors'"
                    [class]="styles.tabList"
                >
                    <ng-template [dockableTabListItem]="model()" let-tab>
                        @let status = serviceOf(tab)?.status;
                        @let alerts = serviceOf(tab)?.alerts ?? 0;
                        <!-- data-status drives what shows: the status colours the icon, a line on
                             top and a badge -->
                        <div [dockableTab]="tab" [attr.data-status]="status ?? null" [class]="styles.tab">
                            <svg
                                [lucideIcon]="ICONS[tab.component]"
                                aria-hidden="true"
                                data-testid="tab-icon"
                                [class]="styles.tabIcon(status)"
                            ></svg>
                            <!-- a pinned tab is only its icon; the name stays for screen readers -->
                            <span [class]="styles.tabName(tab.pinned)">{{ tab.label }}</span>
                            @if (alerts > 0) {
                                <span [class]="styles.alertsLabel">{{
                                    alerts + " open " + (alerts === 1 ? "alert" : "alerts")
                                }}</span>
                                <span data-testid="alert-count" aria-hidden="true" [class]="styles.alertBadge(status)">{{
                                    alerts
                                }}</span>
                            }
                            <span aria-hidden="true" [class]="styles.statusLine(status)"></span>
                        </div>
                    </ng-template>
                </div>
                @if (locked()) {
                    <div [class]="styles.tabsetButtons">
                        <button
                            type="button"
                            [kitTooltipTrigger]="tip"
                            aria-label="Locked region"
                            [class]="styles.lockButton"
                        >
                            <svg lucideLock aria-hidden="true" [class]="styles.lockIcon"></svg>
                        </button>
                        <ng-template #tip>
                            <div kitTooltipContent [class]="styles.tooltip">
                                Locked: only incident tabs can be dropped here
                            </div>
                        </ng-template>
                    </div>
                }
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
export class MonitorTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    protected readonly ICONS = ICONS;
    protected readonly serviceOf = serviceOf;
    protected readonly model = injectDockable<Types>().model;
    protected readonly locked = computed(
        () => this.node().id === INCIDENT_TABSET,
    );
}
