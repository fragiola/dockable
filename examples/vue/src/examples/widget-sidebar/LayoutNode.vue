<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";
import { iconOf } from "./widgets";

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
    <!-- A tabset: a card with the strip of tabs (each with its widget's icon) on top. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <component
                            :is="iconOf(tab)"
                            v-if="iconOf(tab)"
                            aria-hidden="true"
                            :class="styles.tabIcon"
                        />
                        <span :class="styles.tabName">{{ tab.label }}</span>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
