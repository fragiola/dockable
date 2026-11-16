<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import PinButton from "./pin-button.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";
import TabLabel from "./tab-label.vue";

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
    <!-- A tabset: the strip of tabs and the pin button on top, the measured content area below. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <TabLabel :tab="tab" />
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
            <div :class="styles.toolbar">
                <PinButton :tabset="node" />
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
