<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import LogPanel from "../_kit/LogPanel.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";
import Kpi from "./Kpi.vue";

/** The content of a widget's panel. */
defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <Kpi
        v-if="
            tab.component === 'kpi-revenue' || tab.component === 'kpi-conversion'
        "
        :tab="tab"
    />
    <ChartPanel
        v-else-if="tab.component === 'chart-line'"
        kind="line"
        :seed="5"
    />
    <ChartPanel
        v-else-if="tab.component === 'chart-bar'"
        kind="bar"
        :seed="13"
    />
    <ChartPanel
        v-else-if="tab.component === 'chart-area'"
        kind="area"
        :seed="29"
    />
    <TablePanel v-else-if="tab.component === 'table'" />
    <LogPanel v-else />
</template>
