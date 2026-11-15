<script setup lang="ts">
import type { BorderNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

defineProps<{ node: BorderNode<Types> }>();
</script>

<template>
    <Dockable.BorderContent :node="node" :class="styles.borderContent">
        <template #splitter="{ props }">
            <Splitter v-bind="props" />
        </template>
    </Dockable.BorderContent>
</template>
