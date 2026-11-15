<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import KpiPanel from "../_kit/KpiPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import TablePanel from "../_kit/TablePanel.vue";
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
