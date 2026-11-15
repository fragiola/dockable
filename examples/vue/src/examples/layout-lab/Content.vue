<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/ChartPanel.vue";
import LogPanel from "../_kit/LogPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartPanel
        v-if="tab.component === 'chart'"
        :kind="tab.data.kind"
        :seed="tab.label.length"
        :title="tab.label"
    />
    <LogPanel v-else-if="tab.component === 'log'" />
    <PanelBody v-else :title="tab.label">
        <p :class="styles.cardText">
            {{ tab.data?.text ?? "A card: its label names it, its data holds its text." }}
        </p>
    </PanelBody>
</template>
