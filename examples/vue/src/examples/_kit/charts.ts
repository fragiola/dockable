import type { EChartsOption } from "echarts";
import { onMounted, onUnmounted, type Ref, ref } from "vue";

// Demo content: the data and options of the charts ChartPanel and KpiPanel draw, and when to
// (re)draw them. The same as examples/react's `_kit/charts.tsx`, with the composable in Vue.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/** The slices of a pie or donut chart. */
const CHANNELS = ["Direct", "Search", "Social", "Email", "Referral"];

/** The kinds of chart ChartPanel draws. */
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
 * - A panel's content is teleported into the tab's moveable element, which the engine attaches to
 *   the layout after the first render: the chart waits for it (checked once per frame).
 * - A theme switch changes an attribute of `<html>` or `<body>`. The key changes one frame later,
 *   once a popout window has mirrored the attributes (`popoutMirrorRoot`), so a chart that was
 *   moved into a popout re-reads the colours of its own window.
 */
export function useChartKey(element: Ref<HTMLElement | null>) {
    const key = ref<number | null>(null);
    let frame = 0;
    let observer: MutationObserver | undefined;
    onMounted(() => {
        const check = () => {
            if (element.value?.isConnected) {
                key.value = 0;
            } else {
                frame = requestAnimationFrame(check);
            }
        };
        check();
        observer = new MutationObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (key.value !== null) key.value += 1;
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        observer.observe(document.body, { attributes: true });
    });
    onUnmounted(() => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
    });
    return key;
}

/** Each channel's share, in whole percents that add up to about 100. */
function shares(seed: number) {
    const raw = series(seed, CHANNELS.length).map((value) => value + 10);
    const total = raw.reduce((sum, value) => sum + value, 0);
    return raw.map((value) => Math.round((value / total) * 100));
}

/** The ECharts option of a chart kind: two monthly series, or the share of each channel. */
export function chartOption(kind: ChartKind, seed: number): EChartsOption {
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
                    data: shares(seed).map((value, index) => ({
                        name: CHANNELS[index],
                        value,
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

/** The sparkline of a KPI: its last eight months, as a filled line. */
export function sparklineOption(values: number[]): EChartsOption {
    return {
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
    };
}
