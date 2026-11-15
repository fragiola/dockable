<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import LogPanel from "../_kit/LogPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";
import KeysPanel from "./KeysPanel.vue";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <KeysPanel v-if="tab.component === 'keys'" />
    <PanelBody v-else-if="tab.component === 'doc'" :title="tab.label">
        <p>{{ tab.data.text }}</p>
    </PanelBody>
    <TablePanel v-else-if="tab.component === 'table'" />
    <LogPanel v-else />
</template>
