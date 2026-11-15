import { Component, effect, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type Middleware,
    type Node,
    type TabInitOf,
    veto,
} from "@fragiola/dockable-angular";
import { LucideSiren } from "@lucide/angular";
import { SELECT_PARTS } from "#/components/ui/select";
import { SWITCH } from "#/components/ui/switch";
import {
    EventsPanel,
    OverviewPanel,
    RunbookPanel,
    ServicePanel,
    type Types,
} from "./panels";
import { createSimulation, SERVICES, type ServiceId } from "./simulation";
import * as styles from "./styles";
import { INCIDENT_TABSET, MonitorTabSet } from "./tabs";

// A live operations console. A timer streams simulated metrics; each service panel reports its
// alert level to its tab (colour, data-status, alert badge); the overview tab is pinned; the
// incident region accepts only incident tabs (a `model.use` middleware); Ctrl+Shift+Arrow keys
// move focus between tabsets.

const service = (id: ServiceId): TabInitOf<Types> => ({
    id: `service-${id}`,
    component: "service",
    label: SERVICES.find((s) => s.id === id)?.name ?? id,
    data: { service: id },
});

const layout: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { closable: false } },
    root: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 64,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "overview",
                                label: "Overview",
                                pinned: true,
                            },
                            service("api"),
                            service("payments"),
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            service("search"),
                            service("auth"),
                            { component: "events", label: "Events" },
                        ],
                    },
                ],
            },
            {
                type: "tabset",
                id: INCIDENT_TABSET,
                weight: 36,
                children: [
                    {
                        component: "runbook",
                        label: "Runbook",
                    },
                    {
                        component: "timeline",
                        label: "Timeline",
                    },
                ],
            },
        ],
    },
};

/** An incident tab: a runbook or a timeline, the components of the incident region. */
const inIncidentRegion = (node: Node<Types> | undefined) =>
    node?.type === "tab" &&
    (node.component === "runbook" || node.component === "timeline");

/**
 * The locked region, as middleware: incident tabs stay in the incident tabset (they move only
 * into its centre: an edge would split them off into a new tabset), nothing else goes into it or
 * beside it, and the incident tabset may be docked elsewhere but never merged into another one.
 * It vetoes the command itself, so it holds for every move, dragged or not; a drag asks the same
 * question (`model.can`) while hovering, so a refused target shows no drop indicator.
 */
const lockIncidentRegion: Middleware<Types> = (ctx, next) => {
    const refuse = () =>
        veto("Only incident tabs belong in the incident region");
    if (ctx.command === "tab.move") {
        const { tabId, to, location = "center" } = ctx.payload;
        const intoRegion = to === INCIDENT_TABSET && location === "center";
        if (inIncidentRegion(ctx.get("node-by", { id: tabId }))) {
            return intoRegion ? next() : refuse();
        }
        return to === INCIDENT_TABSET ? refuse() : next();
    }
    if (ctx.command === "tabset.move") {
        const { tabsetId, to, location = "center" } = ctx.payload;
        if (tabsetId === INCIDENT_TABSET) {
            return location === "center" ? refuse() : next();
        }
        return to === INCIDENT_TABSET ? refuse() : next();
    }
    return next();
};

const SERVICE_ITEMS = SERVICES.map((s) => ({ value: s.id, label: s.name }));

@Component({
    selector: "example-ops-monitor",
    imports: [
        DOCKABLE,
        SELECT_PARTS,
        SWITCH,
        LucideSiren,
        MonitorTabSet,
        ServicePanel,
        OverviewPanel,
        EventsPanel,
        RunbookPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.shell">
            <div [class]="styles.toolbar">
                <div [class]="styles.liveControl">
                    <button kitSwitch [(checked)]="live" aria-label="Live stream">
                        <span kitSwitchThumb></span>
                    </button>
                    <span [class]="styles.liveLabel(live())">{{ live() ? "Live" : "Paused" }}</span>
                </div>
                <span [class]="styles.shortcutHint">
                    <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd> next panel
                </span>
                <button
                    [kitSelectTrigger]="services"
                    [items]="SERVICE_ITEMS"
                    [(value)]="target"
                    aria-label="Service"
                    [class]="styles.serviceSelect"
                >
                    <span kitSelectValue></span>
                </button>
                <ng-template #services>
                    <div kitSelectContent>
                        @for (s of SERVICES; track s.id) {
                            <div [kitSelectItem]="s.id">{{ s.name }}</div>
                        }
                    </div>
                </ng-template>
                <button type="button" (click)="trigger()" [class]="styles.dangerButton">
                    <svg lucideSiren aria-hidden="true" [class]="styles.buttonIcon"></svg>
                    Trigger incident
                </button>
                <button type="button" (click)="simulation.resolveAll()" [class]="styles.button">
                    Resolve all
                </button>
            </div>
            <div [class]="styles.frame">
                <div [dockableRoot]="model" [keyMap]="keyMap" [class]="styles.root">
                    <!-- A row's child: a tabset (MonitorTabSet, in tabs.ts), or a nested row
                         rendered with these same templates. -->
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <example-ops-monitor-tabset [node]="node" />
                            }
                        </ng-template>
                        <ng-template dockableRowSplitter let-node="node" let-index="index">
                            <div
                                [dockableSplitter]="node"
                                [index]="index"
                                aria-label="Resize"
                                [class]="styles.splitter"
                            >
                                <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                            </div>
                        </ng-template>
                    </div>
                    <!-- every service panel reports its status, so all of them render, not only the
                         visible ones -->
                    <ng-template [dockablePanels]="model" [renderOnDemand]="false" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            <!-- tab.data narrows on tab.component: a service panel gets its
                                 service's data -->
                            @switch (tab.component) {
                                @case ("service") {
                                    <example-ops-service-panel [tab]="tab" [simulation]="simulation" />
                                }
                                @case ("overview") {
                                    <example-ops-overview-panel [simulation]="simulation" />
                                }
                                @case ("events") {
                                    <example-ops-events-panel [simulation]="simulation" />
                                }
                                @case ("timeline") {
                                    <example-ops-events-panel
                                        [simulation]="simulation"
                                        [only]="['warning', 'critical']"
                                    />
                                }
                                @case ("runbook") {
                                    <example-ops-runbook-panel [simulation]="simulation" />
                                }
                            }
                        </div>
                    </ng-template>
                    <!-- Where a dragged tab would land (a refused target shows none). -->
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                </div>
            </div>
        </div>
    `,
})
export default class OpsMonitor {
    protected readonly styles = styles;
    protected readonly SERVICES = SERVICES;
    protected readonly SERVICE_ITEMS = SERVICE_ITEMS;
    protected readonly simulation = createSimulation();
    protected readonly model = createModel<Types>(layout);
    protected readonly live = signal(true);
    protected readonly target = signal<ServiceId>("payments");
    protected readonly keyMap = {
        focusNextTabset: "Ctrl+Shift+ArrowRight",
        focusPreviousTabset: "Ctrl+Shift+ArrowLeft",
    };

    constructor() {
        this.model.use(lockIncidentRegion);
        // the stream: started while live, and always stopped when the example goes
        effect((onCleanup) => {
            if (this.live()) {
                onCleanup(this.simulation.start(1000));
            }
        });
    }

    protected trigger() {
        this.simulation.trigger(this.target());
    }
}
