<script setup lang="ts">
import { type TabOf, useModelState } from "@fragiola/dockable-vue";
import { computed } from "vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import KpiPanel from "../_kit/KpiPanel.vue";
import LogPanel from "../_kit/LogPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import type { Types } from "./dockable";
import { paletteOf } from "./palettes";
import * as styles from "./styles";

/**
 * The panel's content in its tabset's palette. Panels live in a layer outside their tabset
 * (gap 2), so they cannot inherit its palette: the content repeats it, read from the model. (It
 * goes on the content rather than on the `Dockable.Panel`: the panel keeps `palette-raised`, which
 * an added `palette-surface` cannot override, since the surface rules come first in the
 * stylesheet.)
 */
const props = defineProps<{ tab: TabOf<Types> }>();
const palette = useModelState<Types, string>((_, model) =>
    paletteOf(model.get("node-parent-by", { nodeId: props.tab.id })),
);
// a chart or a KPI fills the panel; text and a log grow from it
const fill = computed(
    () => props.tab.component === "chart" || props.tab.component === "kpi",
);
</script>

<template>
    <div :data-palette="palette" :class="styles.content(palette, fill)">
        <!-- A chart derives its series from the palette: it redraws when that changes (its `key`). -->
        <ChartPanel
            v-if="tab.component === 'chart'"
            :key="palette"
            :kind="tab.data.kind"
            :seed="5"
            :class="styles.chart"
        />
        <KpiPanel
            v-else-if="tab.component === 'kpi'"
            :key="palette"
            :label="tab.label"
            :seed="tab.data.seed"
            :class="styles.chart"
        />
        <PanelBody v-else-if="tab.component === 'note'" :title="tab.label">
            <p>{{ tab.data.text }}</p>
        </PanelBody>
        <LogPanel v-else />
    </div>
</template>
