<script setup lang="ts">
import type { RowSplitterProps } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * The bar between two children of a row, 8px thick, with a grip of three dots in the middle.
 * `data-orientation` is the ARIA one: "vertical" is a bar between side-by-side panes.
 */
defineProps<RowSplitterProps<Types>>();
</script>

<template>
    <Dockable.Splitter
        :node="node"
        :index="index"
        aria-label="Resize"
        :class="styles.splitter"
    >
        <span aria-hidden="true" :class="styles.grip">
            <span :class="styles.dot" />
            <span :class="styles.dot" />
            <span :class="styles.dot" />
        </span>
    </Dockable.Splitter>
</template>
