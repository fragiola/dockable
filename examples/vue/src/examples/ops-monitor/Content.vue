<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import type { Types } from "./dockable";
import EventsPanel from "./EventsPanel.vue";
import OverviewPanel from "./OverviewPanel.vue";
import RunbookPanel from "./RunbookPanel.vue";
import ServicePanel from "./ServicePanel.vue";
import type { Simulation } from "./simulation";

// `tab.data` narrows on `tab.component`: a service panel gets its service's data
defineProps<{ tab: TabOf<Types>; simulation: Simulation }>();
</script>

<template>
    <ServicePanel
        v-if="tab.component === 'service'"
        :tab="tab"
        :simulation="simulation"
    />
    <OverviewPanel
        v-else-if="tab.component === 'overview'"
        :simulation="simulation"
    />
    <EventsPanel
        v-else-if="tab.component === 'events'"
        :simulation="simulation"
    />
    <EventsPanel
        v-else-if="tab.component === 'timeline'"
        :simulation="simulation"
        :only="['warning', 'critical']"
    />
    <RunbookPanel v-else :simulation="simulation" />
</template>
