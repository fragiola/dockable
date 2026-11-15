<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/PanelBody.vue";
import TablePanel from "../_kit/TablePanel.vue";
import type { Types } from "./dockable";
import JsonPanel from "./JsonPanel.vue";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <JsonPanel v-if="tab.component === 'json'" />
    <PanelBody v-else-if="tab.component === 'doc'" :title="tab.label">
        <p>{{ tab.data.text }}</p>
    </PanelBody>
    <TablePanel v-else />
</template>
