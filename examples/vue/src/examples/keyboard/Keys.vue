<script setup lang="ts">
import { toAriaKeyShortcuts } from "@fragiola/dockable-vue";
import { computed } from "vue";
import * as styles from "./styles";

// `"Control+Alt+ArrowRight"` → `["Control", "Alt", "ArrowRight"]`, for `<kbd>` rendering.
const props = defineProps<{ spec: string | undefined }>();
const aria = computed(() => toAriaKeyShortcuts(props.spec));
</script>

<template>
    <span v-if="aria" :class="styles.keys">
        <kbd v-for="key in aria.split('+')" :key="key" :class="styles.key">
            {{ key }}
        </kbd>
    </span>
</template>
