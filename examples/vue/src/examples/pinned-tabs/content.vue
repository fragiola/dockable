<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import KpiPanel from "../_kit/kpi-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

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
        :unit="tab.data.unit"
    />
    <TablePanel v-else-if="tab.component === 'table'" />
    <PanelBody v-else :title="tab.label">
        <p :class="styles.panelText">{{ tab.data.text }}</p>
    </PanelBody>
</template>
