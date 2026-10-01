"use client";

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
import { Badge } from "#/components/atoms/badge";
import { Chart } from "#/components/ui/chart";
import { Table } from "#/components/ui/table";
import { useChartKey } from "../_kit/charts";
import {
    DEFAULT_FILTERS,
    type Filters,
    KPIS,
    kpiValue,
    METRICS,
    months,
    ORDERS,
    type Types,
    type WidgetTab,
} from "./data";
import * as styles from "./styles";

// The widgets a tab can hold, chosen by the tab's `component` and configured by its `data`.
// They read the shared filters from context: a portal (the panel, or a popout window) keeps the
// React context of where it is declared.

export const FiltersContext = createContext<Filters>(DEFAULT_FILTERS);

/**
 * A Fragiola chart. The Line/Bar choice is local state: pop the tab out to another window and
 * it is still there, since the content moves with its tab instead of remounting.
 */
export function ChartWidget({ tab }: { tab: WidgetTab<"chart"> }) {
    const filters = useContext(FiltersContext);
    const config = tab.data;
    const [kind, setKind] = useState<"line" | "bar">(config.kind ?? "line");
    const ref = useRef<HTMLDivElement | null>(null);
    const chartKey = useChartKey(ref);

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
        <div ref={ref} className={styles.chart}>
            <div className={styles.chartHeader}>
                <span className={styles.chartTotal}>
                    {`$${(total / 10).toFixed(1)}k`}
                </span>
                {Object.keys(data).map((name, index) => (
                    <span key={name} className={styles.legendItem}>
                        <span
                            aria-hidden="true"
                            className={styles.legendDot}
                            style={{ background: `var(--chart-${index + 1})` }}
                        />
                        {name}
                    </span>
                ))}
                <fieldset className={styles.segments}>
                    <legend className={styles.segmentsLegend}>
                        Chart type
                    </legend>
                    {(["line", "bar"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={kind === value}
                            onClick={() => setKind(value)}
                            className={styles.segment}
                        >
                            {value === "line" ? "Line" : "Bar"}
                        </button>
                    ))}
                </fieldset>
            </div>
            {chartKey === null ? null : (
                <Chart
                    key={chartKey}
                    option={option}
                    className={styles.chartCanvas}
                />
            )}
        </div>
    );
}

/**
 * A KPI. It compares its value with a threshold and writes the result into its TAB's data
 * (the `tab.update` command), and the tab turns red: the tab follows its content.
 */
export function KpiWidget({ tab }: { tab: WidgetTab<"kpi"> }) {
    const filters = useContext(FiltersContext);
    const { model } = useDockable<Types>();
    const config = tab.data;
    const kpi = KPIS[config.metric];
    const [threshold, setThreshold] = useState<number>(kpi.threshold);
    const value = kpiValue(config.metric, filters);
    const status = value < threshold ? "alert" : "ok";

    useEffect(() => {
        if (config.status !== status) {
            model.run("tab.update", {
                tabId: tab.id,
                component: "kpi",
                data: { ...config, status },
            });
        }
    }, [model, tab.id, config, status]);

    const format = (n: number) =>
        kpi.unit === "$" ? `$${n.toFixed(0)}` : `${n.toFixed(1)}${kpi.unit}`;

    return (
        <div data-status={status} className={styles.kpi}>
            <p className={styles.kpiTitle}>{kpi.title}</p>
            <p data-testid="kpi-value" className={styles.kpiValue(status)}>
                {format(value)}
            </p>
            <div className={styles.kpiFooter}>
                <Badge variant="soft" className={styles.kpiBadge(status)}>
                    {status === "alert" ? "Below target" : "On target"}
                </Badge>
                <label className={styles.kpiThreshold}>
                    Alert below
                    <input
                        type="number"
                        value={threshold}
                        step={kpi.unit === "$" ? 5 : 0.1}
                        onChange={(event) =>
                            setThreshold(Number(event.target.value))
                        }
                        className={styles.kpiInput}
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
    return (
        <div className={styles.orders}>
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Order</Table.Head>
                        <Table.Head>Customer</Table.Head>
                        <Table.Head>Region</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head className={styles.amountHead}>
                            Amount
                        </Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {rows.map((order) => (
                        <Table.Row key={order.id}>
                            <Table.Cell className={styles.orderId}>
                                {order.id}
                            </Table.Cell>
                            <Table.Cell>{order.customer}</Table.Cell>
                            <Table.Cell>{order.region}</Table.Cell>
                            <Table.Cell>
                                <Badge
                                    className={styles.orderStatus[order.status]}
                                >
                                    {order.status}
                                </Badge>
                            </Table.Cell>
                            <Table.Cell className={styles.amount}>
                                {`$${order.amount}`}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </div>
    );
}
