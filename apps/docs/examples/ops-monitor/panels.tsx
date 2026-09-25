"use client";

import { Actions, type TabNode } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import type { EChartsOption } from "echarts";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { Badge } from "@/components/atoms/badge";
import { Chart } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { useExampleTheme } from "../_kit/charts";
import {
    type Level,
    type OpsEvent,
    SERVICES,
    type ServiceId,
    type Simulation,
    THRESHOLDS,
} from "./simulation";

// The content of each tab. Every panel subscribes to the simulation and unsubscribes when it
// unmounts (useSyncExternalStore does both).

/** A status as a palette: the same mapping colours tabs, badges and log lines. */
export const LEVEL_PALETTE: Record<Level | "info", string> = {
    ok: "palette-green",
    warning: "palette-orange",
    critical: "palette-danger",
    info: "",
};

/** What a service tab keeps in its `config`; `status` and `alerts` are written by its panel. */
export interface ServiceConfig {
    service: ServiceId;
    status?: Level;
    alerts?: number;
}

function useSimulation(simulation: Simulation) {
    return useSyncExternalStore(
        simulation.subscribe,
        simulation.getSnapshot,
        simulation.getSnapshot,
    );
}

/**
 * One service, live. When its alert level changes it writes the level into its TAB's config
 * (`Actions.updateNodeAttributes`); the tab reads it back and recolours. Only on a change, not
 * on every sample, so the model sees a handful of actions, not one a second.
 */
export function ServicePanel({
    tab,
    simulation,
}: {
    tab: TabNode;
    simulation: Simulation;
}) {
    const { engine } = useDockable();
    const config = tab.getConfig() as ServiceConfig;
    const state = useSimulation(simulation).services[config.service];
    const ref = useRef<HTMLDivElement | null>(null);
    const theme = useExampleTheme(ref);

    useEffect(() => {
        if (config.status !== state.level || config.alerts !== state.alerts) {
            engine.doAction(
                Actions.updateNodeAttributes(tab.getId(), {
                    config: {
                        ...config,
                        status: state.level,
                        alerts: state.alerts,
                    },
                }),
            );
        }
    }, [engine, tab, config, state.level, state.alerts]);

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
        <div ref={ref} className="flex h-full min-h-40 flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <Badge
                    data-testid="service-status"
                    className={LEVEL_PALETTE[state.level]}
                >
                    {state.level}
                </Badge>
                {[
                    ["p95", `${latest} ms`],
                    ["errors", `${state.errors}%`],
                    ["cpu", `${state.cpu}%`],
                ].map(([term, value]) => (
                    <span key={term} className="flex items-baseline gap-1.5">
                        <span className="text-palette-accent/85">{term}</span>
                        <span className="text-sm font-semibold tabular-nums">
                            {value}
                        </span>
                    </span>
                ))}
            </div>
            {theme ? (
                <div
                    className={cn("min-h-0 flex-1", LEVEL_PALETTE[state.level])}
                >
                    {/* keyed on theme and level: the Fragiola chart reads its colours on mount */}
                    <Chart
                        key={`${theme}-${state.level}`}
                        option={option}
                        className="h-full"
                    />
                </div>
            ) : null}
        </div>
    );
}

/** Every service at a glance; a row opens the service's tab. */
export function OverviewPanel({ simulation }: { simulation: Simulation }) {
    const { engine, model } = useDockable();
    const { services } = useSimulation(simulation);
    const open = (id: ServiceId) => {
        if (model.getNodeById(`service-${id}`)) {
            engine.doAction(Actions.selectTab(`service-${id}`));
        }
    };
    return (
        <div className="p-3">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Service</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head className="text-end">p95</Table.Head>
                        <Table.Head className="w-1/3">CPU</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {SERVICES.map((service) => {
                        const state = services[service.id];
                        return (
                            <Table.Row key={service.id}>
                                <Table.Cell className="py-1.5">
                                    <button
                                        type="button"
                                        onClick={() => open(service.id)}
                                        className="underline-offset-2 outline-none hover:underline focus-visible:underline"
                                    >
                                        {service.name}
                                    </button>
                                </Table.Cell>
                                <Table.Cell className="py-1.5">
                                    <Badge
                                        className={LEVEL_PALETTE[state.level]}
                                    >
                                        {state.level}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell className="py-1.5 text-end tabular-nums">
                                    {`${state.latency[state.latency.length - 1]} ms`}
                                </Table.Cell>
                                <Table.Cell className="py-1.5">
                                    <Progress.Root
                                        value={state.cpu}
                                        aria-label={`${service.name} CPU`}
                                        className={
                                            LEVEL_PALETTE[
                                                state.cpu > 80
                                                    ? "critical"
                                                    : "ok"
                                            ]
                                        }
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
        <li className="flex gap-2">
            <span className="text-palette-accent/85">{event.time}</span>
            <span
                className={cn(
                    "w-16 shrink-0 uppercase",
                    event.level === "info"
                        ? "text-palette-accent/85"
                        : `${LEVEL_PALETTE[event.level]} text-palette-accent`,
                )}
            >
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
        <ol className="flex flex-col gap-0.5 p-3 font-mono text-xs leading-5">
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
        <div className="flex flex-col gap-3 p-3 text-sm">
            <p
                className={cn(
                    failing.length > 0
                        ? "palette-danger text-palette-accent"
                        : "text-palette-accent/85",
                )}
            >
                {failing.length > 0
                    ? `Active incident: ${failing.map((s) => s.name).join(", ")}`
                    : "No active incident."}
            </p>
            <ol className="flex flex-col gap-1.5">
                {STEPS.map((step, index) => (
                    <li key={step}>
                        <label className="flex items-start gap-2">
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
                                className="mt-0.5 accent-(--palette-ring)"
                            />
                            <span
                                className={cn(
                                    done.has(index) &&
                                        "text-palette-accent/85 line-through",
                                )}
                            >
                                {step}
                            </span>
                        </label>
                    </li>
                ))}
            </ol>
        </div>
    );
}
