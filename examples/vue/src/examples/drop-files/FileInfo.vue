<script setup lang="ts">
import { FileText } from "@lucide/vue";
import { formatSize } from "./files";
import * as styles from "./styles";

defineProps<{ type: string; size: number }>();
</script>

<template>
    <div :class="styles.info">
        <FileText aria-hidden="true" :class="styles.infoIcon" />
        <p>{{ `${type || "unknown type"} · ${formatSize(size)}` }}</p>
        <p :class="styles.note">No viewer for this kind of file.</p>
    </div>
</template>
