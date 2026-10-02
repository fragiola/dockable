"use client";

import type { TabInitOf, TabOf } from "@fragiola/dockable-react";
import {
    ChartLine,
    ChartNoAxesColumn,
    ChartPie,
    type LucideIcon,
    ScrollText,
    Table2,
} from "lucide-react";
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
        icon: ChartLine,
    },
    {
        component: "channels",
        title: "Channels chart",
        description: "Orders per channel",
        icon: ChartNoAxesColumn,
    },
    {
        component: "orders",
        title: "Orders table",
        description: "The latest orders",
        icon: Table2,
    },
    {
        component: "log",
        title: "Server log",
        description: "A live log stream",
        icon: ScrollText,
    },
    {
        component: "share",
        title: "Channel share",
        description: "Each channel's share of orders",
        icon: ChartPie,
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
export function WidgetContent({ tab }: { tab: TabOf<Types> }) {
    switch (tab.component) {
        case "revenue":
            return <ChartPanel kind="area" seed={7} />;
        case "channels":
            return <ChartPanel kind="bar" seed={21} />;
        case "orders":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
        case "share":
            return <ChartPanel kind="donut" seed={12} />;
    }
}
