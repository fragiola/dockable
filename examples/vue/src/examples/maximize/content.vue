<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel v-if="tab.component === 'chart'" kind="area" :seed="3" />
    <ChartPanel v-else-if="tab.component === 'bars'" kind="bar" :seed="19" />
    <TablePanel v-else />
</template>
