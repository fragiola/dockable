"use client";

import type { EChartsOption } from "echarts";
import {
    type ReactNode,
    type RefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Chart } from "#/components/ui/chart";
import { cn } from "#/lib/cn";

// Demo content: a Fragiola UI chart that fills its panel and follows the example theme.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/** The slices of a pie or donut chart. */
const CHANNELS = ["Direct", "Search", "Social", "Email", "Referral"];

/** The kinds of chart {@link ChartPanel} draws. */
export const CHART_KINDS = ["line", "bar", "area", "pie", "donut"] as const;

export type ChartKind = (typeof CHART_KINDS)[number];

/** A deterministic pseudo-random series, so the examples look the same on every load. */
export function series(seed: number, length = MONTHS.length, scale = 100) {
    let value = seed;
    return Array.from({ length }, () => {
        value = (value * 9301 + 49297) % 233280;
        return Math.round((value / 233280) * scale);
    });
}

/**
 * When to (re)mount a Fragiola chart, which reads its colours from its own element when it mounts:
 * `null` until the element is in the document, then a key that changes after every theme switch.
 *
 * - A panel's content is portalled into the tab's moveable element, which the engine attaches to
 *   the layout after the first commit: the chart waits for it (checked once per frame).
 * - A theme switch changes an attribute of `<html>` or `<body>`. The key changes one frame later,
 *   once a popout window has mirrored the attributes (`popoutMirrorRoot`), so a chart that was
 *   moved into a popout re-reads the colours of its own window.
 */
export function useChartKey(ref: RefObject<HTMLElement | null>) {
    const [key, setKey] = useState<number | null>(null);
    useEffect(() => {
        let frame = 0;
        const check = () => {
            if (ref.current?.isConnected) {
                setKey(0);
            } else {
                frame = requestAnimationFrame(check);
            }
        };
        check();
        const observer = new MutationObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() =>
                setKey((current) => (current === null ? null : current + 1)),
            );
        });
        observer.observe(document.documentElement, { attributes: true });
        observer.observe(document.body, { attributes: true });
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [ref]);
    return key;
}

/** The ECharts option of a chart kind: two monthly series, or the share of each channel. */
function chartOption(kind: ChartKind, seed: number): EChartsOption {
    if (kind === "pie" || kind === "donut") {
        return {
            tooltip: {
                trigger: "item",
                valueFormatter: (value) => `${value}%`,
            },
            legend: { bottom: 0, icon: "circle", itemWidth: 8, itemHeight: 8 },
            series: [
                {
                    type: "pie",
                    // a donut leaves the middle empty; both stay clear of the legend
                    radius: kind === "donut" ? ["45%", "70%"] : "70%",
                    center: ["50%", "45%"],
                    // the legend names the slices: no labels to collide in a narrow panel
                    label: { show: false },
                    itemStyle: { borderWidth: 2, borderColor: "transparent" },
                    data: CHANNELS.map((name, index) => ({
                        name,
                        value: (series(seed, CHANNELS.length)[index] ?? 0) + 10,
                    })),
                },
            ],
        };
    }
    const type = kind === "bar" ? "bar" : "line";
    return {
        grid: { left: 36, right: 16, top: 16, bottom: 28 },
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: MONTHS },
        yAxis: { type: "value" },
        series: [
            {
                type,
                smooth: kind !== "bar",
                areaStyle: kind === "area" ? { opacity: 0.2 } : undefined,
                data: series(seed),
            },
            { type, smooth: kind !== "bar", data: series(seed + 11) },
        ],
    };
}

/** A Fragiola chart that fills its panel and follows the example theme. */
export function ChartPanel({
    kind = "line",
    seed = 7,
    title,
    className,
}: {
    kind?: ChartKind;
    seed?: number;
    title?: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const chartKey = useChartKey(ref);
    const option = useMemo(() => chartOption(kind, seed), [kind, seed]);
    return (
        <div
            ref={ref}
            className={cn("flex h-full min-h-40 flex-col p-3", className)}
        >
            {title ? <h2 className="px-1 pb-2 text-sm">{title}</h2> : null}
            {chartKey === null ? null : (
                <Chart
                    key={chartKey}
                    option={option}
                    className="min-h-0 flex-1"
                />
            )}
        </div>
    );
}

/**
 * A KPI: a figure, its change since last month (green up, red down) and a sparkline of the last
 * eight months, all from one seed.
 */
export function KpiPanel({
    label,
    seed = 7,
    unit = "",
    className,
}: {
    label: ReactNode;
    seed?: number;
    unit?: string;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const chartKey = useChartKey(ref);
    const values = useMemo(() => series(seed, MONTHS.length, 1000), [seed]);
    const last = values.at(-1) ?? 0;
    const previous = values.at(-2) ?? 0;
    const delta =
        previous === 0 ? 0 : Math.round(((last - previous) / previous) * 100);
    const option = useMemo<EChartsOption>(
        () => ({
            grid: { left: 0, right: 0, top: 4, bottom: 0 },
            xAxis: { type: "category", show: false, data: MONTHS },
            yAxis: { type: "value", show: false },
            series: [
                {
                    type: "line",
                    smooth: true,
                    symbol: "none",
                    areaStyle: { opacity: 0.15 },
                    data: values,
                },
            ],
        }),
        [values],
    );
    return (
        <div
            ref={ref}
            className={cn(
                "flex h-full min-h-32 flex-col justify-center gap-1 p-4",
                className,
            )}
        >
            <span className="text-sm text-palette-accent/85">{label}</span>
            <span className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">
                    {`${unit}${last.toLocaleString("en-US")}`}
                </span>
                <span
                    className={cn(
                        "rounded-full bg-palette-base px-2 py-0.5 text-xs font-medium tabular-nums text-palette-contrast",
                        delta >= 0 ? "palette-green" : "palette-danger",
                    )}
                >
                    {`${delta >= 0 ? "+" : ""}${delta}%`}
                </span>
            </span>
            {chartKey === null ? null : (
                <Chart
                    key={chartKey}
                    option={option}
                    className="h-24 max-h-[50%] min-h-12"
                />
            )}
        </div>
    );
}
