"use client";

import { type IJsonTabNode, type Node, TabNode } from "@fragiola/dockable";
import {
    ChartArea,
    ChartLine,
    ChartNoAxesColumn,
    Gauge,
    type LucideIcon,
    ScrollText,
    Table2,
    TrendingUp,
} from "lucide-react";
import { ChartPanel, series } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";

/** A widget of the palette, and the tab it becomes. */
export interface Widget {
    component: string;
    title: string;
    icon: LucideIcon;
    group: "KPIs" | "Charts" | "Data";
}

export const WIDGETS: Widget[] = [
    {
        component: "kpi-revenue",
        title: "Revenue",
        icon: TrendingUp,
        group: "KPIs",
    },
    {
        component: "kpi-conversion",
        title: "Conversion",
        icon: Gauge,
        group: "KPIs",
    },
    {
        component: "chart-line",
        title: "Trend",
        icon: ChartLine,
        group: "Charts",
    },
    {
        component: "chart-bar",
        title: "Channels",
        icon: ChartNoAxesColumn,
        group: "Charts",
    },
    {
        component: "chart-area",
        title: "Traffic",
        icon: ChartArea,
        group: "Charts",
    },
    { component: "table", title: "Orders", icon: Table2, group: "Data" },
    { component: "log", title: "Events", icon: ScrollText, group: "Data" },
];

export const GROUPS = ["KPIs", "Charts", "Data"] as const;

export function widgetTab(widget: Widget): IJsonTabNode {
    return { type: "tab", name: widget.title, component: widget.component };
}

export function widgetOf(tab: TabNode): Widget | undefined {
    return WIDGETS.find((widget) => widget.component === tab.getComponent());
}

/** KPI widgets are tabs whose component starts with "kpi-" (a dragged tab, or one of the palette). */
export function isKpi(node: Node): boolean {
    return (
        node instanceof TabNode &&
        node.getComponent()?.startsWith("kpi-") === true
    );
}

function Kpi({ tab }: { tab: TabNode }) {
    const values = series(
        tab.getComponent() === "kpi-revenue" ? 3 : 9,
        8,
        1000,
    );
    const last = values.at(-1) ?? 0;
    const previous = values.at(-2) ?? 1;
    const change = ((last - previous) / Math.max(previous, 1)) * 100;
    const up = change >= 0;
    return (
        <div className="flex h-full flex-col justify-center gap-1 p-4">
            <p className="text-sm text-palette-accent/85">{tab.getName()}</p>
            <p className="text-3xl font-semibold tabular-nums">
                {tab.getComponent() === "kpi-revenue"
                    ? `$${last}k`
                    : `${(last / 100).toFixed(1)}%`}
            </p>
            <p
                className={`${up ? "palette-green" : "palette-danger"} text-sm text-palette-accent`}
            >
                {`${up ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs last month`}
            </p>
        </div>
    );
}

/** The content of a widget's panel. */
export function WidgetContent({ tab }: { tab: TabNode }) {
    switch (tab.getComponent()) {
        case "kpi-revenue":
        case "kpi-conversion":
            return <Kpi tab={tab} />;
        case "chart-line":
            return <ChartPanel kind="line" seed={5} />;
        case "chart-bar":
            return <ChartPanel kind="bar" seed={13} />;
        case "chart-area":
            return <ChartPanel kind="area" seed={29} />;
        case "table":
            return <TablePanel />;
        default:
            return <LogPanel />;
    }
}
