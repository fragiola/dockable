<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import * as styles from "./styles";

defineProps<{ message: string }>();
</script>

<template>
    <div role="alert" :class="styles.error">
        <TriangleAlert aria-hidden="true" :class="styles.errorIcon" />
        <p>{{ message }}</p>
    </div>
</template>
