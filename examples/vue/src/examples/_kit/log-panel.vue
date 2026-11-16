<script setup lang="ts">
// Demo content: a log that appends a line every `interval` ms while mounted.
import { onMounted, onUnmounted, ref } from "vue";
import { LOG_LINES } from "./data";

const props = withDefaults(defineProps<{ interval?: number }>(), {
    interval: 1500,
});
const lines = ref(LOG_LINES.slice(0, 3));
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
    timer = setInterval(() => {
        lines.value = [
            ...lines.value,
            LOG_LINES[lines.value.length % LOG_LINES.length] ?? "",
        ].slice(-200);
    }, props.interval);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
    <pre class="m-0 p-3 font-mono text-xs leading-5 whitespace-pre-wrap"><div
        v-for="(line, index) in lines"
        :key="index"
        class="text-palette-accent/85"
    >{{ line }}</div></pre>
</template>
