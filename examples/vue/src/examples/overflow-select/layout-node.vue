<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import OverflowSelect from "./overflow-select.vue";
import ScrollingTab from "./scrolling-tab.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";
import Tab from "./tab.vue";

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
    <!-- A tabset whose strip overflows as its data says: into a select, or by scrolling. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList
                v-if="node.data?.overflow === 'scroll'"
                aria-label="Tools"
                :overflow="false"
                :class="styles.scrollingTabList"
            >
                <template #default="{ tab }">
                    <ScrollingTab :tab="tab" />
                </template>
            </Dockable.TabList>
            <template v-else>
                <Dockable.TabList aria-label="Files" :class="styles.tabList">
                    <template #default="{ tab }">
                        <Tab :tab="tab" />
                    </template>
                </Dockable.TabList>
                <OverflowSelect :tabset="node" />
            </template>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
