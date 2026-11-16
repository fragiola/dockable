<script setup lang="ts">
import { FileCode2, FileJson, FileText, Hash } from "@lucide/vue";
import { computed } from "vue";
import * as styles from "./styles";

/** A file type: its icon, and the tone that colours it. */
type FileType = [typeof FileCode2, styles.FileTone];

/** A file icon, coloured by type through a palette (so every theme recolours it). */
const props = defineProps<{ path: string; class?: string | undefined }>();
const type = computed((): FileType => {
    const path = props.path;
    return path.endsWith(".json")
        ? [FileJson, "orange"]
        : path.endsWith(".md")
          ? [FileText, "green"]
          : path.endsWith(".css")
            ? [Hash, "purple"]
            : [FileCode2, "blue"];
});
const iconClass = computed(() => styles.fileIcon(type.value[1], props.class));
</script>

<template>
    <component
        :is="type[0]"
        aria-hidden="true"
        :class="iconClass"
    />
</template>
