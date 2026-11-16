<script setup lang="ts">
import type { TabsetNode } from "@fragiola/dockable-vue";
import { Lock } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import LockBadge from "./lock-badge.vue";
import { LOCKED } from "./regions";
import * as styles from "./styles";

/** A tabset: the strip of tabs and its lock on top, the measured content area below. */
defineProps<{ node: TabsetNode<Types> }>();
</script>

<template>
    <Dockable.TabSet :node="node" :class="styles.tabset(LOCKED.has(node.id))">
        <div :class="styles.strip">
            <!-- a tabset created by a drop has no name of its own -->
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
                <LockBadge :tabset="node" />
            </div>
        </div>
        <Dockable.TabSetContent />
        <!-- over the whole tabset (its strip and its panel) while it refuses the drag -->
        <div
            aria-hidden="true"
            data-testid="refused-overlay"
            :class="styles.refusedOverlay"
        >
            <span :class="styles.refusedBadge">
                <Lock :class="styles.refusedIcon" />
            </span>
            <span :class="styles.refusedText">Not allowed here</span>
        </div>
    </Dockable.TabSet>
</template>
