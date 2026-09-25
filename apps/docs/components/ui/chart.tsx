"use client";
// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/chart.json, source registry/ui/chart.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import type { EChartsOption } from "echarts";
import EChartsReact from "echarts-for-react";
import * as React from "react";
import { type ThemeTokens, useThemeTokens } from "@/hooks/use-theme-tokens";
import { cn } from "@/lib/cn";

// Chart — an ECharts wrapper that resolves the active theme's tokens and
// applies them to the chart's axes, series and tooltip.
//
// The chart tokens are a separate axis from the palette contract
// (architecture.md §5): no role describes "the third series", and reusing
// danger as series 4 breaks its meaning. The categorical derivation
// (chart-1 through chart-8) lives in global.css as theme machinery, derived
// from --palette-base via oklch(from ...).
//
// This wrapper does three things:
// 1. Reads the theme tokens via useThemeTokens, scoped to its own element
//    (re-reads on theme change). Because the read is scoped, a palette
//    class on the chart — `className="palette-blue"` — re-derives the
//    series colours from that palette for this chart alone.
// 2. Merges them into the option's axis, series and tooltip colours
// 3. Renders ECharts with the merged option
//
// It does NOT re-implement ECharts' API — the consumer passes a full
// EChartsOption, and the wrapper only injects colours. This keeps the
// wrapper thin and avoids locking consumers out of ECharts' features.
//
// Sizing: the wrapper is `w-full` only. ECharts reads its height from the
// parent, so the consumer gives the chart a height (`className="h-72"`).

export type ChartProps = {
    option: EChartsOption;
    className?: string;
    /** X-axis categories for the convenience shorthand. */
    categories?: string[];
};

export function Chart({ option, className, categories }: ChartProps) {
    const scope = React.useRef<HTMLDivElement>(null);
    const tokens = useThemeTokens(scope);
    const merged = React.useMemo(
        () => (tokens ? mergeTheme(option, tokens, { categories }) : null),
        [option, tokens, categories],
    );

    return (
        <div
            ref={scope}
            data-slot="chart"
            className={cn("w-full", className as string)}
        >
            {/* Tokens live on the DOM: nothing to draw until they are read.
                Rendering with empty colours is the silent failure this
                replaces — ECharts draws every series in "" and shows a
                blank plot. */}
            {merged ? (
                <EChartsReact
                    option={merged}
                    style={{ height: "100%", width: "100%" }}
                    opts={{ renderer: "svg" }}
                    notMerge
                    lazyUpdate
                />
            ) : null}
        </div>
    );
}

type Loose = Record<string, unknown>;

function asObject(value: unknown): Loose | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Loose)
        : undefined;
}

function mergeTheme(
    option: EChartsOption,
    tokens: ThemeTokens,
    shorthand: Pick<ChartProps, "categories">,
): EChartsOption {
    const { categorical, palette } = tokens;
    const { categories } = shorthand;

    // Series colours: one categorical slot per series, in order. A series
    // coloured per data item (pie, or `colorBy: "data"`) is left alone so
    // the top-level `color` palette applies slice by slice — a single
    // series colour would paint every slice the same.
    const rawSeries = option.series;
    const seriesList = (
        Array.isArray(rawSeries) ? rawSeries : rawSeries ? [rawSeries] : []
    ) as Loose[];
    const series = seriesList.map((s, i) =>
        s.color || s.type === "pie" || s.colorBy === "data"
            ? s
            : { ...s, color: categorical[i % categorical.length] },
    );

    const axisStyle = {
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { lineStyle: { color: palette.line } },
        axisLabel: { color: palette.accent },
        splitLine: { lineStyle: { color: palette.line } },
    };

    // Axes are injected only for cartesian charts. A pie has none, and
    // handing it a value axis draws an empty grid behind the donut.
    const isCartesian = Boolean(categories || option.xAxis || option.yAxis);
    const xAxis = isCartesian
        ? {
              type: "category",
              ...(categories ? { data: categories } : {}),
              ...axisStyle,
              ...asObject(option.xAxis),
          }
        : option.xAxis;
    const yAxis = isCartesian
        ? { type: "value", ...axisStyle, ...asObject(option.yAxis) }
        : option.yAxis;

    const title = asObject(option.title);
    const legend = asObject(option.legend);

    // Text roles: the chart draws on whatever floor it sits on, which is a
    // foreign background for the chart's own palette — so every label is
    // `accent`, never `contrast` (content on a base YOU painted; in a
    // chromatic scope that is white on white). The tooltip is a soft box:
    // soft + line + accent, the same trio as a soft badge.
    return {
        color: categorical,
        textStyle: { color: palette.accent },
        ...option,
        title: title && {
            ...title,
            textStyle: {
                color: palette.accent,
                fontWeight: 600,
                ...asObject(title.textStyle),
            },
        },
        legend: legend && {
            textStyle: { color: palette.accent },
            ...legend,
        },
        tooltip: {
            backgroundColor: palette.soft,
            borderColor: palette.line,
            textStyle: { color: palette.accent },
            ...asObject(option.tooltip),
        },
        xAxis,
        yAxis,
        series,
    } as EChartsOption;
}
