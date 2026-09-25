"use client";

import type { EChartsOption } from "echarts";
import { type ReactNode, useMemo, useRef } from "react";
import { Chart } from "@/components/ui/chart";
import { cn } from "@/lib/cn";
import { useExampleTheme } from "./theme";

// Demo content: a Fragiola UI chart that fills its panel and follows the example theme.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/** A deterministic pseudo-random series, so the examples look the same on every load. */
export function series(seed: number, length = MONTHS.length, scale = 100) {
    let value = seed;
    return Array.from({ length }, () => {
        value = (value * 9301 + 49297) % 233280;
        return Math.round((value / 233280) * scale);
    });
}

/** A Fragiola chart that fills its panel and follows the example theme. */
export function ChartPanel({
    kind = "line",
    seed = 7,
    title,
    className,
}: {
    kind?: "line" | "bar" | "area";
    seed?: number;
    title?: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const theme = useExampleTheme(ref);
    const option = useMemo<EChartsOption>(
        () => ({
            grid: { left: 36, right: 16, top: 16, bottom: 28 },
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: MONTHS },
            yAxis: { type: "value" },
            series: [
                {
                    type: kind === "bar" ? "bar" : "line",
                    smooth: kind !== "bar",
                    areaStyle: kind === "area" ? { opacity: 0.2 } : undefined,
                    data: series(seed),
                },
                {
                    type: kind === "bar" ? "bar" : "line",
                    smooth: kind !== "bar",
                    data: series(seed + 11),
                },
            ],
        }),
        [kind, seed],
    );
    return (
        <div
            ref={ref}
            className={cn("flex h-full min-h-40 flex-col p-3", className)}
        >
            {title ? <h2 className="px-1 pb-2 text-sm">{title}</h2> : null}
            {/* drawn once the theme is known: the chart reads its colours on mount */}
            {theme ? (
                <Chart key={theme} option={option} className="min-h-0 flex-1" />
            ) : null}
        </div>
    );
}
