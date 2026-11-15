import { Component, computed, input } from "@angular/core";
import type { TabInitOf, TabOf } from "@fragiola/dockable-angular";
import {
    LucideChartArea,
    LucideChartLine,
    LucideChartNoAxesColumn,
    LucideGauge,
    type LucideIcon,
    LucideScrollText,
    LucideTable2,
    LucideTrendingUp,
} from "@lucide/angular";
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
        icon: LucideTrendingUp,
        group: "KPIs",
    },
    {
        component: "kpi-conversion",
        title: "Conversion",
        icon: LucideGauge,
        group: "KPIs",
    },
    {
        component: "chart-line",
        title: "Trend",
        icon: LucideChartLine,
        group: "Charts",
    },
    {
        component: "chart-bar",
        title: "Channels",
        icon: LucideChartNoAxesColumn,
        group: "Charts",
    },
    {
        component: "chart-area",
        title: "Traffic",
        icon: LucideChartArea,
        group: "Charts",
    },
    { component: "table", title: "Orders", icon: LucideTable2, group: "Data" },
    {
        component: "log",
        title: "Events",
        icon: LucideScrollText,
        group: "Data",
    },
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

@Component({
    selector: "example-dashboard-kpi",
    host: { class: "contents" },
    template: `
        <div [class]="styles.kpi">
            <p [class]="styles.kpiLabel">{{ tab().label }}</p>
            <p [class]="styles.kpiValue">{{ figures().value }}</p>
            <p [class]="styles.kpiChange(figures().up)">{{ figures().change }}</p>
        </div>
    `,
})
export class Kpi {
    readonly tab = input.required<TabOf<Types>>();
    protected readonly styles = styles;
    protected readonly figures = computed(() => {
        const tab = this.tab();
        const values = series(tab.component === "kpi-revenue" ? 3 : 9, 8, 1000);
        const last = values.at(-1) ?? 0;
        const previous = values.at(-2) ?? 1;
        const change = ((last - previous) / Math.max(previous, 1)) * 100;
        const up = change >= 0;
        return {
            up,
            value:
                tab.component === "kpi-revenue"
                    ? `$${last}k`
                    : `${(last / 100).toFixed(1)}%`,
            change: `${up ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs last month`,
        };
    });
}

/** The content of a widget's panel. */
@Component({
    selector: "example-dashboard-widget",
    imports: [Kpi, ChartPanel, TablePanel, LogPanel],
    host: { class: "contents" },
    template: `
        @switch (tab().component) {
            @case ("kpi-revenue") {
                <example-dashboard-kpi [tab]="tab()" />
            }
            @case ("kpi-conversion") {
                <example-dashboard-kpi [tab]="tab()" />
            }
            @case ("chart-line") {
                <kit-chart-panel kind="line" [seed]="5" />
            }
            @case ("chart-bar") {
                <kit-chart-panel kind="bar" [seed]="13" />
            }
            @case ("chart-area") {
                <kit-chart-panel kind="area" [seed]="29" />
            }
            @case ("table") {
                <kit-table-panel />
            }
            @default {
                <kit-log-panel />
            }
        }
    `,
})
export class WidgetContent {
    readonly tab = input.required<TabOf<Types>>();
}
