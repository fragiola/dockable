<script setup lang="ts">
import type { RowNode, TabsetNode } from "@fragiola/dockable-vue";
import { Inbox } from "@lucide/vue";
import ClosableTab from "./closable-tab.vue";
import CloseTabsetButton from "./close-tabset-button.vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./splitter.vue";
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
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <ClosableTab :tab="tab" />
                </template>
            </Dockable.TabList>
            <div :class="styles.toolbar">
                <CloseTabsetButton :tabset="node" />
            </div>
        </div>
        <!-- No panel covers an empty tabset's content area, so it can show a hint. The `render`
             slot gets the element's props (its `ref` fits any element) and its state
             ({ empty }). -->
        <Dockable.TabSetContent>
            <template #render="{ props, state }">
                <div v-bind="props">
                    <div v-if="state.empty" :class="styles.emptyHint">
                        <Inbox aria-hidden="true" :class="styles.emptyIcon" />
                        <p>Nothing open. Drag a tab here.</p>
                    </div>
                </div>
            </template>
        </Dockable.TabSetContent>
    </Dockable.TabSet>
</template>
