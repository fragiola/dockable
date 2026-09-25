"use client";

import type { IJsonTabNode, TabNode } from "@fragiola/dockable";
import {
    ChartLine,
    ChartNoAxesColumn,
    type LucideIcon,
    NotebookPen,
    ScrollText,
    Table2,
} from "lucide-react";
import { Card } from "../_kit/card";
import { ChartPanel } from "../_kit/charts";
import { LogPanel, TablePanel } from "../_kit/data";

/** A widget the sidebar offers: what it looks like there, and the tab a drop creates. */
export interface Widget {
    component: string;
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
        component: "notes",
        title: "Notes",
        description: "A counter and a notes field",
        icon: NotebookPen,
    },
];

/** The tab a widget becomes. No id: the model gives each new tab its own, so a widget can be added twice. */
export function widgetTab(widget: Widget): IJsonTabNode {
    return { type: "tab", name: widget.title, component: widget.component };
}

export function iconOf(tab: TabNode): LucideIcon | undefined {
    return WIDGETS.find((widget) => widget.component === tab.getComponent())
        ?.icon;
}

/** The content of a widget's panel. */
export function WidgetContent({ tab }: { tab: TabNode }) {
    switch (tab.getComponent()) {
        case "revenue":
            return <ChartPanel kind="area" seed={7} />;
        case "channels":
            return <ChartPanel kind="bar" seed={21} />;
        case "orders":
            return <TablePanel />;
        case "log":
            return <LogPanel />;
        default:
            return <Card tab={tab} />;
    }
}
