<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel
        v-if="tab.component === 'chart'"
        :kind="tab.data.kind"
        :seed="tab.label.length"
        :title="tab.label"
    />
    <TablePanel v-else />
</template>
