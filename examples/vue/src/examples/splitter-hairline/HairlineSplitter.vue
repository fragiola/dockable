<script setup lang="ts">
import type { RowSplitterProps } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * The splitter, VS Code style: a 1px line (what the engine measures for the split maths) with a
 * 7px grab area that fills only while dragging or on keyboard focus. `data-orientation` is the
 * ARIA one: "vertical" is a bar between side-by-side panes.
 */
defineProps<RowSplitterProps<Types>>();
</script>

<template>
    <Dockable.Splitter
        :node="node"
        :index="index"
        aria-label="Resize"
        :class="styles.splitter"
    />
</template>
