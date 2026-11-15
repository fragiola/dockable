<script setup lang="ts">
import type { TabsetNode } from "@fragiola/dockable-vue";
import { LayoutDashboard } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import { widgetOf } from "./widgets";

/** A tabset: a card with the strip of tabs on top, and a hint in the empty canvas. */
defineProps<{ node: TabsetNode<Types> }>();
</script>

<template>
    <Dockable.TabSet :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <!-- the tabset's name from the layout ("KPI strip", "Canvas") -->
            <Dockable.TabList
                :aria-label="node.data?.name || 'Tabs'"
                :class="styles.tabList"
            >
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <component
                            :is="widgetOf(tab)?.icon"
                            v-if="widgetOf(tab)"
                            aria-hidden="true"
                            :class="styles.tabIcon"
                        />
                        <span :class="styles.tabName">{{ tab.label }}</span>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
        </div>
        <!-- no panel covers an empty tabset, so its content area can show a hint -->
        <Dockable.TabSetContent>
            <template #render="{ props, state }">
                <div v-bind="props">
                    <div v-if="state.empty" :class="styles.emptyHint">
                        <LayoutDashboard
                            aria-hidden="true"
                            :class="styles.emptyHintIcon"
                        />
                        <p>Drag charts and tables here.</p>
                    </div>
                </div>
            </template>
        </Dockable.TabSetContent>
    </Dockable.TabSet>
</template>
