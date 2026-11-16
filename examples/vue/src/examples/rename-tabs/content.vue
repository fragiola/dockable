<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import KpiPanel from "../_kit/kpi-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <PanelBody v-if="tab.component === 'note'" :title="tab.label">
        <p :class="styles.hint">{{ tab.data.text }}</p>
    </PanelBody>
    <ChartPanel
        v-else-if="tab.component === 'chart'"
        :kind="tab.data.kind"
        :seed="tab.data.seed"
        :title="tab.label"
    />
    <KpiPanel v-else :label="tab.label" :seed="tab.data.seed" />
</template>
