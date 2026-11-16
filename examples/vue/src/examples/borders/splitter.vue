<script setup lang="ts">
import type { BorderNode, RowNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * The bar between two children of a row, or beside a border's panel, with a grip for the themes
 * that show one.
 */
defineProps<{ node: RowNode<Types> | BorderNode<Types>; index?: number }>();
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
