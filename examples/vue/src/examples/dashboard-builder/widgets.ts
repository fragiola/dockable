import type { TabInitOf, TabOf } from "@fragiola/dockable-vue";
import {
    ChartArea,
    ChartLine,
    ChartNoAxesColumn,
    Gauge,
    type LucideIcon,
    ScrollText,
    Table2,
    TrendingUp,
} from "@lucide/vue";
import type { Types } from "./dockable";

/** The widget components: each is a tab component with no data (the tab is named by its label). */
export type WidgetComponent =
    | "kpi-revenue"
    | "kpi-conversion"
    | "chart-line"
    | "chart-bar"
    | "chart-area"
    | "table"
    | "log";

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
