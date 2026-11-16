<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import KpiPanel from "../_kit/kpi-panel.vue";
import LogPanel from "../_kit/log-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import TablePanel from "../_kit/table-panel.vue";
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
        <!-- English in an RTL page: `dir="auto"` keeps its full stop at its end -->
        <p dir="auto">{{ tab.data.text }}</p>
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
