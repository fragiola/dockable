<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import AddMenu from "./AddMenu.vue";
import { Dockable, type Types } from "./dockable";
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
    <!-- A tabset: its strip of tabs with the Add menu at the end, and the measured content area. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <span :class="styles.tabName">{{ tab.label }}</span>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
            <div :class="styles.tabsetButtons">
                <AddMenu :tabset="node" />
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
