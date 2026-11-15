<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import KpiPanel from "../_kit/KpiPanel.vue";
import LogPanel from "../_kit/LogPanel.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <TablePanel v-if="tab.component === 'table'" />
    <ChartPanel
        v-else-if="tab.component === 'chart'"
        :kind="tab.data.kind"
        :seed="tab.data.seed"
        :title="tab.label"
    />
    <LogPanel v-else-if="tab.component === 'log'" />
    <KpiPanel v-else :label="tab.label" :seed="tab.data.seed" />
</template>
