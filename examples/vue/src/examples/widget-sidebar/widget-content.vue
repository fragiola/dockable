<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import LogPanel from "../_kit/log-panel.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";

// The content of a widget's panel.
defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel v-if="tab.component === 'revenue'" kind="area" :seed="7" />
    <ChartPanel
        v-else-if="tab.component === 'channels'"
        kind="bar"
        :seed="21"
    />
    <TablePanel v-else-if="tab.component === 'orders'" />
    <LogPanel v-else-if="tab.component === 'log'" />
    <ChartPanel v-else kind="donut" :seed="12" />
</template>
