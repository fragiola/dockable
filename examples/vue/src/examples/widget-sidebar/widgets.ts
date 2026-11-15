import type { TabInitOf, TabOf } from "@fragiola/dockable-vue";
import {
    ChartLine,
    ChartNoAxesColumn,
    ChartPie,
    type LucideIcon,
    ScrollText,
    Table2,
} from "@lucide/vue";
import type { Types } from "./dockable";

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
