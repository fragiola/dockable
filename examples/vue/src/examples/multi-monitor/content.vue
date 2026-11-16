<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import LogPanel from "../_kit/log-panel.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel v-if="tab.component === 'requests'" kind="area" :seed="11" />
    <ChartPanel
        v-else-if="tab.component === 'latency'"
        kind="line"
        :seed="23"
    />
    <TablePanel
        v-else-if="tab.component === 'orders' || tab.component === 'refunds'"
    />
    <LogPanel v-else />
</template>
