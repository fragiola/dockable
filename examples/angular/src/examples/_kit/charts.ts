import { Component, computed, input } from "@angular/core";
import type { EChartsOption } from "echarts";
import { Chart } from "#/components/ui/chart";
import { cn } from "#/lib/cn";

// Demo content: the charts the examples draw (a chart that fills its panel, a KPI with its
// sparkline) and their data and options. The same as examples/react's `_kit/charts.tsx`; the kit's
// chart reads its colours once it is in a document and after each theme change of its own window,
// so these need no remount key.

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

/** A Fragiola chart that fills its panel and follows the example theme. */
@Component({
    selector: "kit-chart-panel",
    imports: [Chart],
    host: { class: "contents" },
    template: `
        <div [class]="classes()">
            @if (title()) {
                <h2 class="px-1 pb-2 text-sm">{{ title() }}</h2>
            }
            <kit-chart [option]="option()" class="min-h-0 flex-1" />
        </div>
    `,
})
export class ChartPanel {
    readonly kind = input<ChartKind>("line");
    readonly seed = input(7);
    readonly title = input<string>();
    readonly class = input<string>();
    protected readonly option = computed(() =>
        chartOption(this.kind(), this.seed()),
    );
    protected readonly classes = computed(() =>
        cn("flex h-full min-h-40 flex-col p-3", this.class()),
    );
}

/**
 * A KPI: a figure, its change since last month (green up, red down) and a sparkline of the last
 * eight months, all from one seed.
 */
@Component({
    selector: "kit-kpi-panel",
    imports: [Chart],
    host: { class: "contents" },
    template: `
        <div [class]="classes()">
            <span class="text-sm text-palette-accent/85">{{ label() }}</span>
            <span class="flex items-baseline gap-2">
                <span class="text-3xl font-semibold tabular-nums">{{ figure() }}</span>
                <span [class]="deltaClasses()">{{ deltaText() }}</span>
            </span>
            <kit-chart [option]="option()" class="h-24 max-h-[50%] min-h-12" />
        </div>
    `,
})
export class KpiPanel {
    readonly label = input.required<string>();
    readonly seed = input(7);
    readonly unit = input("");
    readonly class = input<string>();
    private readonly values = computed(() =>
        series(this.seed(), MONTHS.length, 1000),
    );
    private readonly last = computed(() => this.values().at(-1) ?? 0);
    private readonly delta = computed(() => {
        const previous = this.values().at(-2) ?? 0;
        return previous === 0
            ? 0
            : Math.round(((this.last() - previous) / previous) * 100);
    });
    protected readonly figure = computed(
        () => `${this.unit()}${this.last().toLocaleString("en-US")}`,
    );
    protected readonly deltaText = computed(
        () => `${this.delta() >= 0 ? "+" : ""}${this.delta()}%`,
    );
    protected readonly deltaClasses = computed(() =>
        cn(
            "rounded-full bg-palette-base px-2 py-0.5 text-xs font-medium tabular-nums text-palette-contrast",
            this.delta() >= 0 ? "palette-green" : "palette-danger",
        ),
    );
    protected readonly option = computed(() => sparklineOption(this.values()));
    protected readonly classes = computed(() =>
        cn(
            "flex h-full min-h-32 flex-col justify-center gap-1 p-4",
            this.class(),
        ),
    );
}
