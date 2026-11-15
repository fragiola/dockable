import {
    afterRenderEffect,
    Component,
    computed,
    type ElementRef,
    effect,
    input,
    type Signal,
    signal,
    untracked,
    viewChild,
} from "@angular/core";
import { injectDockable, type TabNode } from "@fragiola/dockable-angular";
import type { EChartsOption } from "echarts";
import { Badge } from "#/components/atoms/badge";
import { Chart } from "#/components/ui/chart";
import { PROGRESS } from "#/components/ui/progress";
import { TABLE } from "#/components/ui/table";
import {
    type Level,
    type OpsEvent,
    SERVICES,
    type ServiceId,
    type Simulation,
    type Snapshot,
    THRESHOLDS,
} from "./simulation";
import * as styles from "./styles";

// The content of each tab. Every panel subscribes to the simulation and unsubscribes when it is
// destroyed (`injectSimulation` does both).

/** What a service tab keeps in its `data`; `status` and `alerts` are written by its panel. */
export interface ServiceData {
    service: ServiceId;
    status?: Level;
    alerts?: number;
}

export type Types = {
    tabs: {
        overview: undefined;
        service: ServiceData;
        events: undefined;
        runbook: undefined;
        timeline: undefined;
    };
};

/**
 * The simulation's current snapshot, as a signal that follows it (subscribed while the calling
 * component lives). Call it in an injection context, with a signal of the simulation input.
 */
function injectSimulation(simulation: Signal<Simulation>): Signal<Snapshot> {
    const snapshot = signal<Snapshot | undefined>(undefined);
    effect((onCleanup) => {
        const current = simulation();
        untracked(() => snapshot.set(current.getSnapshot()));
        onCleanup(current.subscribe(() => snapshot.set(current.getSnapshot())));
    });
    // before the first effect run, read the simulation directly
    return computed(() => snapshot() ?? simulation().getSnapshot());
}

/**
 * One service, live. When its alert level changes it writes the level into its TAB's data
 * (the `tab.set-data` command); the tab reads it back and recolours. Only on a change, not on
 * every sample, so the model sees a handful of commands, not one a second.
 */
@Component({
    selector: "example-ops-service-panel",
    imports: [Badge, Chart],
    host: { class: "contents" },
    template: `
        <div [class]="styles.servicePanel">
            <div [class]="styles.metrics">
                <span kitBadge data-testid="service-status" [class]="styles.statusBadge(state().level)">{{
                    state().level
                }}</span>
                @for (metric of metrics(); track metric[0]) {
                    <span [class]="styles.metric">
                        <span [class]="styles.metricTerm">{{ metric[0] }}</span>
                        <span [class]="styles.metricValue">{{ metric[1] }}</span>
                    </span>
                }
            </div>
            <div [class]="styles.chartArea(state().level)">
                <!-- keyed on the level: the Fragiola chart reads its colours when it renders, so a
                     palette change renders it again -->
                @for (level of [state().level]; track level) {
                    <kit-chart [option]="option()" [class]="styles.chart" />
                }
            </div>
        </div>
    `,
})
export class ServicePanel {
    readonly tab = input.required<TabNode<"service", ServiceData>>();
    readonly simulation = input.required<Simulation>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    private readonly snapshot = injectSimulation(this.simulation);
    protected readonly state = computed(
        () => this.snapshot().services[this.tab().data.service],
    );
    protected readonly metrics = computed(() => {
        const state = this.state();
        const latest = state.latency[state.latency.length - 1] ?? 0;
        return [
            ["p95", `${latest} ms`],
            ["errors", `${state.errors}%`],
            ["cpu", `${state.cpu}%`],
        ] as const;
    });
    protected readonly option = computed<EChartsOption>(() => {
        const { latency } = this.state();
        return {
            animation: false,
            grid: {
                left: 4,
                right: 12,
                top: 12,
                bottom: 4,
                containLabel: true,
            },
            xAxis: {
                type: "category",
                show: false,
                data: latency.map((_, i) => i),
            },
            yAxis: {
                type: "value",
                splitNumber: 3,
                max: (v) => Math.max(1000, v.max),
            },
            series: [
                {
                    type: "line",
                    data: latency,
                    showSymbol: false,
                    areaStyle: { opacity: 0.15 },
                    markLine: {
                        silent: true,
                        symbol: "none",
                        label: { show: false },
                        lineStyle: { type: "dashed" },
                        data: [
                            { yAxis: THRESHOLDS.warning },
                            { yAxis: THRESHOLDS.critical },
                        ],
                    },
                },
            ],
        };
    });

    constructor() {
        effect(() => {
            const { level, alerts } = this.state();
            const tab = this.tab();
            if (tab.data.status !== level || tab.data.alerts !== alerts) {
                untracked(() =>
                    this.dockable.model().run("tab.set-data", {
                        tabId: tab.id,
                        data: { status: level, alerts },
                    }),
                );
            }
        });
    }
}

/** Every service at a glance; a row opens the service's tab. */
@Component({
    selector: "example-ops-overview-panel",
    imports: [TABLE, Badge, PROGRESS],
    host: { class: "contents" },
    template: `
        <div [class]="styles.overviewPanel">
            <kit-table>
                <thead kitTableHeader>
                    <tr kitTableRow>
                        <th kitTableHead>Service</th>
                        <th kitTableHead>Status</th>
                        <th kitTableHead [class]="styles.headEnd">p95</th>
                        <th kitTableHead [class]="styles.headCpu">CPU</th>
                    </tr>
                </thead>
                <tbody kitTableBody>
                    @for (service of SERVICES; track service.id) {
                        @let state = snapshot().services[service.id];
                        <tr kitTableRow>
                            <td kitTableCell [class]="styles.cell">
                                <button type="button" (click)="open(service.id)" [class]="styles.serviceLink">{{
                                    service.name
                                }}</button>
                            </td>
                            <td kitTableCell [class]="styles.cell">
                                <span kitBadge [class]="styles.statusBadge(state.level)">{{ state.level }}</span>
                            </td>
                            <td kitTableCell [class]="styles.cellNumber">{{
                                state.latency[state.latency.length - 1] + " ms"
                            }}</td>
                            <td kitTableCell [class]="styles.cell">
                                <div
                                    kitProgress
                                    [value]="state.cpu"
                                    [attr.aria-label]="service.name + ' CPU'"
                                    [class]="styles.cpuBar(state.cpu > 80)"
                                >
                                    <div kitProgressTrack><div kitProgressIndicator></div></div>
                                </div>
                            </td>
                        </tr>
                    }
                </tbody>
            </kit-table>
        </div>
    `,
})
export class OverviewPanel {
    readonly simulation = input.required<Simulation>();
    protected readonly styles = styles;
    protected readonly SERVICES = SERVICES;
    private readonly dockable = injectDockable<Types>();
    protected readonly snapshot = injectSimulation(this.simulation);

    protected open(id: ServiceId) {
        const model = this.dockable.model();
        if (model.get("node-by", { id: `service-${id}` })) {
            model.run("tab.select", { tabId: `service-${id}` });
        }
    }
}

/** The event stream, newest last, following the end while it grows. */
@Component({
    selector: "example-ops-events-panel",
    host: { class: "contents" },
    template: `
        <ol [class]="styles.eventsPanel">
            @for (event of shown(); track event.id) {
                <li [class]="styles.eventLine">
                    <span [class]="styles.eventTime">{{ event.time }}</span>
                    <span [class]="styles.eventLevel(event.level)">{{ event.level }}</span>
                    <span>{{ event.text }}</span>
                </li>
            }
            <li #end aria-hidden="true"></li>
        </ol>
    `,
})
export class EventsPanel {
    readonly simulation = input.required<Simulation>();
    /** keep only these levels (the incident timeline shows no info lines) */
    readonly only = input<OpsEvent["level"][]>();
    protected readonly styles = styles;
    private readonly snapshot = injectSimulation(this.simulation);
    protected readonly shown = computed(() => {
        const { events } = this.snapshot();
        const only = this.only();
        return only ? events.filter((e) => only.includes(e.level)) : events;
    });
    private readonly end = viewChild.required<ElementRef<HTMLElement>>("end");

    constructor() {
        // follow the end when a line arrives
        const last = computed(() => this.shown().at(-1)?.id);
        afterRenderEffect(() => {
            last();
            this.end().nativeElement.scrollIntoView({ block: "nearest" });
        });
    }
}

const STEPS = [
    "Acknowledge the page in the on-call channel",
    "Check the latest deploy of the failing service",
    "Roll back if the deploy is younger than an hour",
    "Scale out the service if CPU stays over 80%",
    "Write the timeline in the incident doc",
];

/** The incident runbook: a checklist whose ticks survive any move of the tab. */
@Component({
    selector: "example-ops-runbook-panel",
    host: { class: "contents" },
    template: `
        <div [class]="styles.runbookPanel">
            <p [class]="styles.incidentStatus(failing().length > 0)">{{
                failing().length > 0 ? "Active incident: " + failingNames() : "No active incident."
            }}</p>
            <ol [class]="styles.steps">
                @for (step of STEPS; track step; let index = $index) {
                    <li>
                        <label [class]="styles.stepLabel">
                            <input
                                type="checkbox"
                                [checked]="done().has(index)"
                                (change)="toggle(index)"
                                [class]="styles.stepCheck"
                            />
                            <span [class]="styles.stepText(done().has(index))">{{ step }}</span>
                        </label>
                    </li>
                }
            </ol>
        </div>
    `,
})
export class RunbookPanel {
    readonly simulation = input.required<Simulation>();
    protected readonly styles = styles;
    protected readonly STEPS = STEPS;
    private readonly snapshot = injectSimulation(this.simulation);
    protected readonly done = signal<ReadonlySet<number>>(new Set());
    protected readonly failing = computed(() =>
        SERVICES.filter(
            (s) => this.snapshot().services[s.id].level === "critical",
        ),
    );
    protected readonly failingNames = computed(() =>
        this.failing()
            .map((s) => s.name)
            .join(", "),
    );

    protected toggle(index: number) {
        this.done.update((current) => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }
}
