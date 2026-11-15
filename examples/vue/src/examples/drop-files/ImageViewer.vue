<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { formatSize } from "./files";
import * as styles from "./styles";

const props = defineProps<{ file: File }>();
const url = ref<string | null>(null);
watchEffect((onCleanup) => {
    const objectUrl = URL.createObjectURL(props.file);
    url.value = objectUrl;
    onCleanup(() => URL.revokeObjectURL(objectUrl));
});
</script>

<template>
    <div :class="styles.imageViewer">
        <!-- a plain <img>: the source is a local object URL, which an image optimizer cannot fetch -->
        <img v-if="url" :src="url" :alt="file.name" :class="styles.image" />
        <p :class="styles.caption">
            {{ `${file.type} · ${formatSize(file.size)}` }}
        </p>
    </div>
</template>
