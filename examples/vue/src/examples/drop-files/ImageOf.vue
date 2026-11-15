<script setup lang="ts">
import ErrorNote from "./ErrorNote.vue";
import ImageViewer from "./ImageViewer.vue";

// An image tab whose File is gone (the page reloaded a saved layout) says so.
defineProps<{ file: File | undefined }>();
</script>

<template>
    <ImageViewer v-if="file" :file="file" />
    <ErrorNote v-else message="The image is no longer open: drop it again." />
</template>
