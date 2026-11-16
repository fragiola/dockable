<script setup lang="ts">
import type { BorderNode, RowNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

// A row's splitter (`node`, `index`) or a border's (`node` alone).
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
