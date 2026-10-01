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
    const chartKey = useChartKey(ref);
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
