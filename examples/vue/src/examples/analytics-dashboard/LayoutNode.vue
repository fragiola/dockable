<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";
import TabContent from "./TabContent.vue";
import TabSetButtons from "./TabSetButtons.vue";
import { isAlert } from "./tabs";

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
    <!-- A tabset: a card with the strip of tabs on top (each with its widget's icon and a close
         button) and maximize / pop out / dock back buttons at its end, then the measured content
         area. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab(isAlert(tab))">
                        <TabContent :tab="tab" />
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
            <div :class="styles.toolbar">
                <TabSetButtons :tabset="node" />
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
