<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import type { Types } from "./dockable";
import LayoutJsonPanel from "./LayoutJsonPanel.vue";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <LayoutJsonPanel v-if="tab.component === 'json'" />
    <PanelBody v-else-if="tab.component === 'doc'" :title="tab.label">
        <p>{{ tab.data.text }}</p>
    </PanelBody>
    <ChartPanel
        v-else
        :kind="tab.data.kind"
        :seed="tab.data.seed"
        :title="tab.label"
    />
</template>
