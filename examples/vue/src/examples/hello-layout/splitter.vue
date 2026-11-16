<script setup lang="ts">
import type { RowSplitterProps } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

// The bar between two children of a row, with a grip for the themes that show one. A splitter
// has no name of its own: the row inserts it, so this component names it.
defineProps<RowSplitterProps<Types>>();
</script>

<template>
    <Dockable.Splitter
        :node="node"
        :index="index"
        aria-label="Resize"
        :class="styles.splitter"
    >
        <span aria-hidden="true" :class="styles.splitterGrip" />
    </Dockable.Splitter>
</template>
