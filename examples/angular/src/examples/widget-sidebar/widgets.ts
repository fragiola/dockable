import { Component, input } from "@angular/core";
import type { TabInitOf, TabOf } from "@fragiola/dockable-angular";
import {
    LucideChartLine,
    LucideChartNoAxesColumn,
    LucideChartPie,
    type LucideIcon,
    LucideScrollText,
    LucideTable2,
} from "@lucide/angular";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";

export type Types = {
    tabs: {
        revenue: undefined;
        channels: undefined;
        orders: undefined;
        log: undefined;
        share: undefined;
    };
};

/** A widget the sidebar offers: what it looks like there, and the tab a drop creates. */
export interface Widget {
    component: keyof Types["tabs"];
    title: string;
    description: string;
    icon: LucideIcon;
}

export const WIDGETS: Widget[] = [
    {
        component: "revenue",
        title: "Revenue chart",
        description: "Monthly revenue, this year and last",
        icon: LucideChartLine,
    },
    {
        component: "channels",
        title: "Channels chart",
        description: "Orders per channel",
        icon: LucideChartNoAxesColumn,
    },
    {
        component: "orders",
        title: "Orders table",
        description: "The latest orders",
        icon: LucideTable2,
    },
    {
        component: "log",
        title: "Server log",
        description: "A live log stream",
        icon: LucideScrollText,
    },
    {
        component: "share",
        title: "Channel share",
        description: "Each channel's share of orders",
        icon: LucideChartPie,
    },
];

/** The tab a widget becomes. No id: the model gives each new tab its own, so a widget can be added twice. */
export function widgetTab(widget: Widget): TabInitOf<Types> {
    return { component: widget.component, label: widget.title };
}

export function iconOf(tab: TabOf<Types>): LucideIcon | undefined {
    return WIDGETS.find((widget) => widget.component === tab.component)?.icon;
}

/** The content of a widget's panel. */
@Component({
    selector: "example-widget-content",
    imports: [ChartPanel, TablePanel, LogPanel],
    host: { class: "contents" },
    template: `
        @switch (tab().component) {
            @case ("revenue") {
                <kit-chart-panel kind="area" [seed]="7" />
            }
            @case ("channels") {
                <kit-chart-panel kind="bar" [seed]="21" />
            }
            @case ("orders") {
                <kit-table-panel />
            }
            @case ("log") {
                <kit-log-panel />
            }
            @case ("share") {
                <kit-chart-panel kind="donut" [seed]="12" />
            }
        }
    `,
})
export class WidgetContent {
    readonly tab = input.required<TabOf<Types>>();
}
