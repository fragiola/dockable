<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Position, type Types } from "./dockable";
import Splitter from "./splitter.vue";
import Strip from "./strip.vue";
import * as styles from "./styles";

defineProps<{ node: TabsetNode<Types> | RowNode<Types>; position: Position }>();
</script>

<template>
    <Dockable.Row v-if="node.type === 'row'" :node="node">
        <template #default="{ node: child }">
            <LayoutNode :node="child" :position="position" />
        </template>
        <template #splitter="{ props }">
            <Splitter v-bind="props" />
        </template>
    </Dockable.Row>
    <!-- A tabset is a flex column (`Dockable.TabSet` sets `display: flex; flex-direction:
         column`), and `Dockable.TabSetContent` takes the space left over. So the strip goes
         below the content just by coming after it in the markup: the engine measures the
         content area wherever it is and positions the panel over it. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <Strip v-if="position !== 'bottom'" :bottom="false" />
        <Dockable.TabSetContent />
        <Strip v-if="position === 'bottom'" :bottom="true" />
    </Dockable.TabSet>
</template>
