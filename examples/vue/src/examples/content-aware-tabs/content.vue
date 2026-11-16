<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import type { Types } from "./dockable";
import Editor from "./editor.vue";
import Monitor from "./monitor.vue";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <Monitor v-if="tab.component === 'monitor'" :tab="tab" />
    <Editor v-else :tab="tab" />
</template>
