<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import type { Types } from "./dockable";
import Editor from "./Editor.vue";
import Monitor from "./Monitor.vue";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <Monitor v-if="tab.component === 'monitor'" :tab="tab" />
    <Editor v-else :tab="tab" />
</template>
