<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import KpiPanel from "../_kit/KpiPanel.vue";
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
    <KpiPanel v-else :label="tab.label" :seed="tab.data.seed" />
</template>
