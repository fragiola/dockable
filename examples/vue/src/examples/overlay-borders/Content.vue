<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import KpiPanel from "../_kit/KpiPanel.vue";
import LogPanel from "../_kit/LogPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <KpiPanel
        v-if="tab.component === 'kpi'"
        :label="tab.label"
        :seed="tab.data.seed"
    />
    <PanelBody v-else-if="tab.component === 'doc'" :title="tab.label">
        <p>{{ tab.data.text }}</p>
    </PanelBody>
    <ChartPanel
        v-else-if="tab.component === 'chart'"
        :kind="tab.data.kind"
        :seed="tab.label.length"
        :title="tab.label"
    />
    <TablePanel v-else-if="tab.component === 'table'" />
    <LogPanel v-else />
</template>
