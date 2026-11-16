<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import KpiPanel from "../_kit/kpi-panel.vue";
import LogPanel from "../_kit/log-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

// A tab's content: `tab.data` and the component narrow together.
defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel
        v-if="tab.component === 'chart'"
        :kind="tab.data.kind"
        :seed="tab.data.seed"
        :title="tab.label"
    />
    <KpiPanel
        v-else-if="tab.component === 'kpi'"
        :label="tab.label"
        :seed="tab.data.seed"
    />
    <PanelBody v-else-if="tab.component === 'doc'" :title="tab.label">
        <p :class="styles.panelText">{{ tab.data.text }}</p>
    </PanelBody>
    <TablePanel v-else-if="tab.component === 'table'" />
    <LogPanel v-else />
</template>
