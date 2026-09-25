"use client";

import { Actions, type TabNode } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import type { EChartsOption } from "echarts";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Badge } from "@/components/atoms/badge";
import { Chart } from "@/components/ui/chart";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { useExampleTheme } from "../_kit/charts";
import {
    type ChartMetric,
    DEFAULT_FILTERS,
    type Filters,
    KPIS,
    type KpiMetric,
    kpiValue,
    METRICS,
    months,
    ORDERS,
} from "./data";

// The widgets a tab can hold, chosen by the tab's `component` and configured by its `config`.
// They read the shared filters from context: a portal (the panel, or a popout window) keeps the
// React context of where it is declared.

export const FiltersContext = createContext<Filters>(DEFAULT_FILTERS);

/** What a KPI tab keeps in its `config`; `status` is written by the widget itself. */
export interface KpiConfig {
    metric: KpiMetric;
    status?: "ok" | "alert";
}

const segment = [
    "h-6 px-2 text-xs text-palette-accent/85 outline-none first:rounded-s-md last:rounded-e-md",
    "hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
    "aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast",
].join(" ");

/**
 * A Fragiola chart. The Line/Bar choice is local state: pop the tab out to another window and
 * it is still there, since the content moves with its tab instead of remounting.
 */
export function ChartWidget({ tab }: { tab: TabNode }) {
    const filters = useContext(FiltersContext);
    const config = tab.getConfig() as { metric: ChartMetric; kind?: "bar" };
    const [kind, setKind] = useState<"line" | "bar">(config.kind ?? "line");
    const ref = useRef<HTMLDivElement | null>(null);
    const theme = useExampleTheme(ref);

    const data = useMemo(
        () => METRICS[config.metric](filters),
        [config.metric, filters],
    );
    const option = useMemo<EChartsOption>(
        () => ({
            grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
            tooltip: { trigger: "axis" },
            xAxis: {
                type: "category",
                data: months(filters),
                boundaryGap: kind === "bar",
            },
            yAxis: { type: "value", splitNumber: 3 },
            series: Object.entries(data).map(([name, values]) => ({
                name,
                type: kind,
                data: values,
                smooth: true,
                showSymbol: false,
                stack:
                    kind === "bar" && config.metric === "channels"
                        ? "all"
                        : undefined,
                barMaxWidth: 18,
            })),
        }),
        [data, kind, filters, config.metric],
    );
    const total = Object.values(data)[0]?.reduce((a, b) => a + b, 0) ?? 0;

    return (
        <div ref={ref} className="flex h-full min-h-36 flex-col gap-1 p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-base font-semibold tabular-nums">
                    {`$${(total / 10).toFixed(1)}k`}
                </span>
                {Object.keys(data).map((name, index) => (
                    <span
                        key={name}
                        className="flex items-center gap-1 text-palette-accent/85"
                    >
                        <span
                            aria-hidden="true"
                            className="size-2 rounded-full"
                            style={{ background: `var(--chart-${index + 1})` }}
                        />
                        {name}
                    </span>
                ))}
                <fieldset className="ms-auto flex rounded-md border border-palette-line">
                    <legend className="sr-only">Chart type</legend>
                    {(["line", "bar"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={kind === value}
                            onClick={() => setKind(value)}
                            className={segment}
                        >
                            {value === "line" ? "Line" : "Bar"}
                        </button>
                    ))}
                </fieldset>
            </div>
            {/* keyed on the theme: the Fragiola chart reads its colours from CSS once */}
            {theme ? (
                <Chart key={theme} option={option} className="min-h-0 flex-1" />
            ) : null}
        </div>
    );
}

/**
 * A KPI. It compares its value with a threshold and writes the result into its TAB's config
 * (`Actions.updateNodeAttributes`), and the tab turns red: the tab follows its content.
 */
export function KpiWidget({ tab }: { tab: TabNode }) {
    const filters = useContext(FiltersContext);
    const { engine } = useDockable();
    const config = tab.getConfig() as KpiConfig;
    const kpi = KPIS[config.metric];
    const [threshold, setThreshold] = useState<number>(kpi.threshold);
    const value = kpiValue(config.metric, filters);
    const status = value < threshold ? "alert" : "ok";

    useEffect(() => {
        if (config.status !== status) {
            engine.doAction(
                Actions.updateNodeAttributes(tab.getId(), {
                    config: { ...config, status },
                }),
            );
        }
    }, [engine, tab, config, status]);

    const format = (n: number) =>
        kpi.unit === "$" ? `$${n.toFixed(0)}` : `${n.toFixed(1)}${kpi.unit}`;

    return (
        <div
            data-status={status}
            className="flex min-h-full flex-col justify-center gap-3 p-4"
        >
            <p className="text-sm text-palette-accent/85">{kpi.title}</p>
            <p
                data-testid="kpi-value"
                className={cn(
                    "text-4xl font-semibold tabular-nums",
                    status === "alert" && "palette-danger text-palette-accent",
                )}
            >
                {format(value)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                    variant="soft"
                    className={
                        status === "alert" ? "palette-danger" : "palette-green"
                    }
                >
                    {status === "alert" ? "Below target" : "On target"}
                </Badge>
                <label className="flex items-center gap-2 text-palette-accent/85">
                    Alert below
                    <input
                        type="number"
                        value={threshold}
                        step={kpi.unit === "$" ? 5 : 0.1}
                        onChange={(event) =>
                            setThreshold(Number(event.target.value))
                        }
                        className="h-7 w-20 rounded-md border border-palette-line bg-palette-soft px-2 text-palette-contrast tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-palette-ring"
                    />
                </label>
            </div>
        </div>
    );
}

/** A Fragiola table of the orders in the selected region. */
export function OrdersWidget() {
    const filters = useContext(FiltersContext);
    const rows = ORDERS.filter(
        (order) => filters.region === "all" || order.region === filters.region,
    );
    const tone = {
        Paid: "palette-green",
        Pending: "palette-orange",
        Refunded: "palette-danger",
    };
    return (
        <div className="p-3">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Order</Table.Head>
                        <Table.Head>Customer</Table.Head>
                        <Table.Head>Region</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head className="text-end">Amount</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {rows.map((order) => (
                        <Table.Row key={order.id}>
                            <Table.Cell className="tabular-nums">
                                {order.id}
                            </Table.Cell>
                            <Table.Cell>{order.customer}</Table.Cell>
                            <Table.Cell>{order.region}</Table.Cell>
                            <Table.Cell>
                                <Badge className={tone[order.status]}>
                                    {order.status}
                                </Badge>
                            </Table.Cell>
                            <Table.Cell className="text-end tabular-nums">
                                {`$${order.amount}`}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </div>
    );
}
