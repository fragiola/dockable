<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import RenamableTab from "./RenamableTab.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

defineProps<{
    node: TabsetNode<Types> | RowNode<Types>;
    /** the tab being renamed (its id) */
    editing: string | null;
    setEditing: (id: string | null) => void;
}>();
</script>

<template>
    <Dockable.Row v-if="node.type === 'row'" :node="node">
        <template #default="{ node: child }">
            <LayoutNode
                :node="child"
                :editing="editing"
                :set-editing="setEditing"
            />
        </template>
        <template #splitter="{ props }">
            <Splitter v-bind="props" />
        </template>
    </Dockable.Row>
    <!-- A tabset: a card with the strip of renamable tabs on top and the measured content area
         below. -->
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <RenamableTab
                        :tab="tab"
                        :editing="editing === tab.id"
                        :set-editing="setEditing"
                    />
                </template>
            </Dockable.TabList>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
