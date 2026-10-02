"use client";

import type { TabInitOf, TabOf } from "@fragiola/dockable";
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
import * as styles from "./styles";

/** The widget components: each is a tab component with no data (the tab is named by its label). */
export type WidgetComponent =
    | "kpi-revenue"
    | "kpi-conversion"
    | "chart-line"
    | "chart-bar"
    | "chart-area"
    | "table"
    | "log";

/** What the layout holds: widget tabs have no data (the name is the tab's label); a tabset has a name. */
export type Types = {
    tabs: Record<WidgetComponent, undefined>;
    tabset: { name: string };
};

/** A widget of the palette, and the tab it becomes. */
export interface Widget {
    component: WidgetComponent;
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

/** The tab a widget becomes: a `tab.add` init (its data is checked against its component). */
export function widgetTab(widget: Widget): TabInitOf<Types> {
    return { component: widget.component, label: widget.title };
}

export function widgetOf(tab: TabOf<Types>): Widget | undefined {
    return WIDGETS.find((widget) => widget.component === tab.component);
}

/** KPI widgets are the components whose name starts with "kpi-". */
export function isKpi(component: string): boolean {
    return component.startsWith("kpi-");
}

function Kpi({ tab }: { tab: TabOf<Types> }) {
    const values = series(tab.component === "kpi-revenue" ? 3 : 9, 8, 1000);
    const last = values.at(-1) ?? 0;
    const previous = values.at(-2) ?? 1;
    const change = ((last - previous) / Math.max(previous, 1)) * 100;
    const up = change >= 0;
    return (
        <div className={styles.kpi}>
            <p className={styles.kpiLabel}>{tab.label}</p>
            <p className={styles.kpiValue}>
                {tab.component === "kpi-revenue"
                    ? `$${last}k`
                    : `${(last / 100).toFixed(1)}%`}
            </p>
            <p className={styles.kpiChange(up)}>
                {`${up ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs last month`}
            </p>
        </div>
    );
}

/** The content of a widget's panel. */
export function WidgetContent({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
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
