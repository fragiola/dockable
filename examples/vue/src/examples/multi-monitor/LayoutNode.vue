<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import ScreenButton from "./ScreenButton.vue";
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
    <!-- A tabset: its strip of tabs and its screen buttons on top, the measured content area
         below. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList
                :aria-label="node.data?.name || 'Tabs'"
                :class="styles.tabList"
            >
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <span :class="styles.tabName">{{ tab.label }}</span>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
            <div :class="styles.tabsetActions">
                <ScreenButton :tabset="node" />
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
