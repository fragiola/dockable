import type { ComponentOf } from "@fragiola/dockable-vue";
import { Activity, BookOpen, LayoutDashboard, ScrollText } from "@lucide/vue";
import type { Component } from "vue";
import type { Types } from "./dockable";

// The console's tabsets (monitor-tabset.vue, monitor-tab.vue): the incident tabset's id, and the
// icon of each tab's component.

export const INCIDENT_TABSET = "incident";

export const ICONS: Record<ComponentOf<Types>, Component> = {
    overview: LayoutDashboard,
    service: Activity,
    events: ScrollText,
    runbook: BookOpen,
    timeline: ScrollText,
};
