import type { ComponentOf } from "@fragiola/dockable-vue";
import {
    BookOpenText,
    ChartCandlestick,
    ClipboardList,
    Layers,
    List,
    Newspaper,
    Wallet,
} from "@lucide/vue";
import type { Component } from "vue";
import type { Types } from "./dockable";

// The desk's tabs (trading-tab.vue, trading-tabset.vue): the icon of each tab's component, and the
// tab lists' names.

export const ICONS: Record<ComponentOf<Types>, Component> = {
    watchlist: List,
    news: Newspaper,
    chart: ChartCandlestick,
    book: Layers,
    trades: BookOpenText,
    positions: Wallet,
    orders: ClipboardList,
};

/** The tab lists' names, by tabset id: a tabset created by a drop is a "Panels" one. */
export const TABSET_NAMES: Record<string, string> = {
    market: "Market",
    "chart-area": "Chart",
    depth: "Depth",
};
