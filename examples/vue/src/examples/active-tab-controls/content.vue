<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <!-- keyed on the kind: a pie and a line are different charts -->
    <ChartPanel
        v-if="tab.component === 'chart'"
        :key="tab.data.kind"
        :kind="tab.data.kind"
        :seed="tab.data.seed"
        :title="tab.label"
    />
    <TablePanel v-else />
</template>
