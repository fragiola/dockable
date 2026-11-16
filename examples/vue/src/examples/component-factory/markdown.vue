<script setup lang="ts">
import { computed } from "vue";
import PanelBody from "../_kit/panel-body.vue";
import * as styles from "./styles";

// A tiny markdown subset (headings, list items, paragraphs): enough for the demo.
const props = defineProps<{ text: string }>();
const lines = computed(() =>
    props.text
        .split("\n")
        .map((line, index) => ({ key: `${index}:${line}`, line })),
);
</script>

<template>
    <PanelBody>
        <template v-for="{ key, line } in lines" :key="key">
            <h2 v-if="line.startsWith('# ')" :class="styles.markdownHeading">
                {{ line.slice(2) }}
            </h2>
            <p v-else-if="line.startsWith('- ')" :class="styles.markdownItem">
                {{ line.slice(2) }}
            </p>
            <p v-else-if="line" :class="styles.markdownText">{{ line }}</p>
        </template>
    </PanelBody>
</template>
