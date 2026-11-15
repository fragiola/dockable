<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import KeyboardTab from "./KeyboardTab.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

defineProps<{ node: TabsetNode<Types> | RowNode<Types> }>();
</script>

<template>
    <Dockable.Row v-if="node.type === 'row'" :node="node">
        <template #default="{ node: child }">
            <LayoutNode :node="child" />
        </template>
        <template #splitter="{ props }">
            <Splitter v-bind="props" />
        </template>
    </Dockable.Row>
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <!-- the tabset's name, from its data (a tabset made by a drop has none) -->
            <Dockable.TabList
                :aria-label="node.data?.name || 'Tabs'"
                :class="styles.tabList"
            >
                <template #default="{ tab }">
                    <KeyboardTab :tab="tab" />
                </template>
            </Dockable.TabList>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
