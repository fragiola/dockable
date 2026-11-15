<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";

defineProps<{ node: TabsetNode<Types> | RowNode<Types> }>();
</script>

<template>
    <Dockable.Row v-if="node.type === 'row'" :node="node">
        <template #default="{ node: child }">
            <LayoutNode :node="child" />
        </template>
        <template #splitter="{ props }">
            <Dockable.Splitter v-bind="props" aria-label="Resize" />
        </template>
    </Dockable.Row>
    <Dockable.TabSet v-else :node="node">
        <div>
            <Dockable.TabList aria-label="Tabs">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab">
                        <span>{{ tab.label }}</span>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
