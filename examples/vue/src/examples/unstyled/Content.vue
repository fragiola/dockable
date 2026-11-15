<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { ref } from "vue";
import type { Types } from "./dockable";

// Unstyled content too: a panel renders whatever you give it.
defineProps<{ tab: TabOf<Types> }>();
const count = ref(0);
</script>

<template>
    <div>
        <h2>{{ tab.label }}</h2>
        <button type="button" @click="count++">Count: {{ count }}</button>
    </div>
</template>
