<script setup lang="ts">
import type { BorderNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./Splitter.vue";

/** Where a border's panel opens, with a splitter on the layout's side of it to resize it. */
defineProps<{ node: BorderNode<Types> }>();
</script>

<template>
    <Dockable.BorderContent :node="node">
        <template #splitter="{ props }">
            <Splitter v-bind="props" />
        </template>
    </Dockable.BorderContent>
</template>
