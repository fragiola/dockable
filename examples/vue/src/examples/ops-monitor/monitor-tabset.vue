<script setup lang="ts">
import type { TabsetNode } from "@fragiola/dockable-vue";
import { Lock } from "@lucide/vue";
import { computed } from "vue";
import { Tooltip } from "#/components/ui/tooltip";
import { Dockable, type Types } from "./dockable";
import MonitorTab from "./monitor-tab.vue";
import * as styles from "./styles";
import { INCIDENT_TABSET } from "./tabs";

// The console's tabsets. A service tab reads the status its panel wrote into its data and
// shows it three ways (monitor-tab.vue). The incident tabset is locked: a lock with a tooltip
// says so, and `data-locked` lets styles mark it.
const props = defineProps<{ node: TabsetNode<Types> }>();
const locked = computed(() => props.node.id === INCIDENT_TABSET);
</script>

<template>
    <Dockable.TabSet
        :node="node"
        :data-locked="locked ? '' : undefined"
        :class="styles.tabset"
    >
        <div :class="styles.strip">
            <Dockable.TabList
                :aria-label="locked ? 'Incident' : 'Monitors'"
                :class="styles.tabList"
            >
                <template #default="{ tab }">
                    <MonitorTab :tab="tab" />
                </template>
            </Dockable.TabList>
            <div v-if="locked" :class="styles.tabsetButtons">
                <Tooltip.Root>
                    <Tooltip.Trigger
                        aria-label="Locked region"
                        :class="styles.lockButton"
                    >
                        <Lock aria-hidden="true" :class="styles.lockIcon" />
                    </Tooltip.Trigger>
                    <Tooltip.Content :class="styles.tooltip">
                        Locked: only incident tabs can be dropped here
                    </Tooltip.Content>
                </Tooltip.Root>
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
