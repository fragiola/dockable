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
    <TablePanel v-if="tab.component === 'table'" />
    <PanelBody v-else-if="tab.component === 'note'" :title="tab.label">
        <p :class="styles.panelText">{{ tab.data.text }}</p>
    </PanelBody>
    <ChartPanel
        v-else-if="tab.component === 'chart'"
        kind="bar"
        :seed="tab.data.seed"
        :title="tab.label"
    />
    <KpiPanel v-else :label="tab.label" :seed="tab.data.seed" />
</template>
