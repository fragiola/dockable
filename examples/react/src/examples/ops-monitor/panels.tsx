"use client";

import type { TabNode } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import type { EChartsOption } from "echarts";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { Badge } from "#/components/atoms/badge";
import { Chart } from "#/components/ui/chart";
import { Progress } from "#/components/ui/progress";
import { Table } from "#/components/ui/table";
import { useChartKey } from "../_kit/charts";
import {
    type Level,
    type OpsEvent,
    SERVICES,
    type ServiceId,
    type Simulation,
    THRESHOLDS,
} from "./simulation";
import * as styles from "./styles";

// The content of each tab. Every panel subscribes to the simulation and unsubscribes when it
// unmounts (useSyncExternalStore does both).

/** What a service tab keeps in its `data`; `status` and `alerts` are written by its panel. */
export interface ServiceData {
    service: ServiceId;
    status?: Level;
    alerts?: number;
}

/** What an incident tab keeps in its `data`: the region it belongs to (and may not leave). */
export interface IncidentData {
    region: "incident";
}

/** What the console holds: each tab component and the type of its data. */
export type Types = {
    tabs: {
        overview: undefined;
        service: ServiceData;
        events: undefined;
        runbook: IncidentData;
        timeline: IncidentData;
    };
};

function useSimulation(simulation: Simulation) {
    return useSyncExternalStore(
        simulation.subscribe,
        simulation.getSnapshot,
        simulation.getSnapshot,
    );
}

/**
 * One service, live. When its alert level changes it writes the level into its TAB's data
 * (the `tab.set-data` command); the tab reads it back and recolours. Only on a change, not on
 * every sample, so the model sees a handful of commands, not one a second.
 */
export function ServicePanel({
    tab,
    simulation,
}: {
    tab: TabNode<"service", ServiceData>;
    simulation: Simulation;
}) {
    const { model } = useDockable<Types>();
    const config = tab.data;
    const state = useSimulation(simulation).services[config.service];
    const ref = useRef<HTMLDivElement | null>(null);
    const chartKey = useChartKey(ref);

    useEffect(() => {
        if (config.status !== state.level || config.alerts !== state.alerts) {
            model.run("tab.set-data", {
                tabId: tab.id,
                data: { status: state.level, alerts: state.alerts },
            });
        }
    }, [model, tab.id, config, state.level, state.alerts]);

    const option = useMemo<EChartsOption>(
        () => ({
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
                data: state.latency.map((_, i) => i),
            },
            yAxis: {
                type: "value",
                splitNumber: 3,
                max: (v) => Math.max(1000, v.max),
            },
            series: [
                {
                    type: "line",
                    data: state.latency,
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
        }),
        [state.latency],
    );
    const latest = state.latency[state.latency.length - 1] ?? 0;

    return (
        <div ref={ref} className={styles.servicePanel}>
            <div className={styles.metrics}>
                <Badge
                    data-testid="service-status"
                    className={styles.statusBadge(state.level)}
                >
                    {state.level}
                </Badge>
                {[
                    ["p95", `${latest} ms`],
                    ["errors", `${state.errors}%`],
                    ["cpu", `${state.cpu}%`],
                ].map(([term, value]) => (
                    <span key={term} className={styles.metric}>
                        <span className={styles.metricTerm}>{term}</span>
                        <span className={styles.metricValue}>{value}</span>
                    </span>
                ))}
            </div>
            {chartKey === null ? null : (
                <div className={styles.chartArea(state.level)}>
                    {/* keyed on the theme and the level: the Fragiola chart reads its colours
                        when it mounts, so a palette change remounts it too */}
                    <Chart
                        key={`${chartKey}-${state.level}`}
                        option={option}
                        className={styles.chart}
                    />
                </div>
            )}
        </div>
    );
}

/** Every service at a glance; a row opens the service's tab. */
export function OverviewPanel({ simulation }: { simulation: Simulation }) {
    const { model } = useDockable<Types>();
    const { services } = useSimulation(simulation);
    const open = (id: ServiceId) => {
        if (model.get("node-by", { id: `service-${id}` })) {
            model.run("tab.select", { tabId: `service-${id}` });
        }
    };
    return (
        <div className={styles.overviewPanel}>
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Service</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head className={styles.headEnd}>p95</Table.Head>
                        <Table.Head className={styles.headCpu}>CPU</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {SERVICES.map((service) => {
                        const state = services[service.id];
                        return (
                            <Table.Row key={service.id}>
                                <Table.Cell className={styles.cell}>
                                    <button
                                        type="button"
                                        onClick={() => open(service.id)}
                                        className={styles.serviceLink}
                                    >
                                        {service.name}
                                    </button>
                                </Table.Cell>
                                <Table.Cell className={styles.cell}>
                                    <Badge
                                        className={styles.statusBadge(
                                            state.level,
                                        )}
                                    >
                                        {state.level}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell className={styles.cellNumber}>
                                    {`${state.latency[state.latency.length - 1]} ms`}
                                </Table.Cell>
                                <Table.Cell className={styles.cell}>
                                    <Progress.Root
                                        value={state.cpu}
                                        aria-label={`${service.name} CPU`}
                                        className={styles.cpuBar(
                                            state.cpu > 80,
                                        )}
                                    >
                                        <Progress.Track>
                                            <Progress.Indicator />
                                        </Progress.Track>
                                    </Progress.Root>
                                </Table.Cell>
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table.Root>
        </div>
    );
}

function EventLine({ event }: { event: OpsEvent }) {
    return (
        <li className={styles.eventLine}>
            <span className={styles.eventTime}>{event.time}</span>
            <span className={styles.eventLevel(event.level)}>
                {event.level}
            </span>
            <span>{event.text}</span>
        </li>
    );
}

/** The event stream, newest last, following the end while it grows. */
export function EventsPanel({
    simulation,
    only,
}: {
    simulation: Simulation;
    /** keep only these levels (the incident timeline shows no info lines) */
    only?: OpsEvent["level"][];
}) {
    const { events } = useSimulation(simulation);
    const shown = only ? events.filter((e) => only.includes(e.level)) : events;
    const end = useRef<HTMLLIElement | null>(null);
    const last = shown[shown.length - 1]?.id;
    // biome-ignore lint/correctness/useExhaustiveDependencies: follow the end when a line arrives
    useEffect(() => {
        end.current?.scrollIntoView({ block: "nearest" });
    }, [last]);
    return (
        <ol className={styles.eventsPanel}>
            {shown.map((event) => (
                <EventLine key={event.id} event={event} />
            ))}
            <li ref={end} aria-hidden="true" />
        </ol>
    );
}

const STEPS = [
    "Acknowledge the page in the on-call channel",
    "Check the latest deploy of the failing service",
    "Roll back if the deploy is younger than an hour",
    "Scale out the service if CPU stays over 80%",
    "Write the timeline in the incident doc",
];

/** The incident runbook: a checklist whose ticks survive any move of the tab. */
export function RunbookPanel({ simulation }: { simulation: Simulation }) {
    const { services } = useSimulation(simulation);
    const [done, setDone] = useState<ReadonlySet<number>>(new Set());
    const failing = SERVICES.filter((s) => services[s.id].level === "critical");
    return (
        <div className={styles.runbookPanel}>
            <p className={styles.incidentStatus(failing.length > 0)}>
                {failing.length > 0
                    ? `Active incident: ${failing.map((s) => s.name).join(", ")}`
                    : "No active incident."}
            </p>
            <ol className={styles.steps}>
                {STEPS.map((step, index) => (
                    <li key={step}>
                        <label className={styles.stepLabel}>
                            <input
                                type="checkbox"
                                checked={done.has(index)}
                                onChange={() =>
                                    setDone((current) => {
                                        const next = new Set(current);
                                        if (next.has(index)) next.delete(index);
                                        else next.add(index);
                                        return next;
                                    })
                                }
                                className={styles.stepCheck}
                            />
                            <span className={styles.stepText(done.has(index))}>
                                {step}
                            </span>
                        </label>
                    </li>
                ))}
            </ol>
        </div>
    );
}
