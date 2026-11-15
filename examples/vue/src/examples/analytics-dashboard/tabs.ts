import type { ComponentOf, TabOf } from "@fragiola/dockable-vue";
import { ChartLine, Gauge, Sheet } from "@lucide/vue";
import type { Component } from "vue";
import type { Types } from "./data";

// How the dashboard decorates its tabsets: an icon per widget type, a red tab for a KPI below
// target (TabContent.vue: the icon, the name and a close button; TabSetButtons.vue: maximize /
// pop out / dock back in the header).

/** A KPI below its target: its tab takes the danger palette and a warning icon. */
export function isAlert(tab: TabOf<Types>) {
    return tab.component === "kpi" && tab.data.status === "alert";
}

export const ICONS: Record<ComponentOf<Types>, Component> = {
    chart: ChartLine,
    table: Sheet,
    kpi: Gauge,
};
