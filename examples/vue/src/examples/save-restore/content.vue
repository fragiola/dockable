<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/panel-body.vue";
import TablePanel from "../_kit/table-panel.vue";
import type { Types } from "./dockable";
import JsonPanel from "./json-panel.vue";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <JsonPanel v-if="tab.component === 'json'" />
    <PanelBody v-else-if="tab.component === 'doc'" :title="tab.label">
        <p>{{ tab.data.text }}</p>
    </PanelBody>
    <TablePanel v-else />
</template>
