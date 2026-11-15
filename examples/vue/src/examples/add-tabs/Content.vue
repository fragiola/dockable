<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import LogPanel from "../_kit/LogPanel.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel
        v-if="tab.component === 'chart'"
        :seed="tab.label.length * 7"
    />
    <TablePanel v-else-if="tab.component === 'table'" />
    <LogPanel v-else />
</template>
