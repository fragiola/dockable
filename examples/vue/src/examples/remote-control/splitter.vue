<script setup lang="ts">
import type { RowSplitterProps } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

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
