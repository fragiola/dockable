<script setup lang="ts">
import type { BorderNode, TabOf } from "@fragiola/dockable-vue";
import { Bug, FolderTree, SquareTerminal } from "@lucide/vue";
import { computed } from "vue";
import { Tooltip } from "#/components/ui/tooltip";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

const BORDER_ICONS: Partial<
    Record<TabOf<Types>["component"], typeof FolderTree>
> = {
    explorer: FolderTree,
    terminal: SquareTerminal,
    problems: Bug,
};

/**
 * A border's strip. The start border is an activity bar, as in VS Code: an upright icon per tab,
 * named by `aria-label` and a tooltip, in a bar as wide as its icon buttons. The bottom border's
 * tabs keep their icon and name.
 */
const props = defineProps<{ node: BorderNode<Types> }>();
const side = computed(
    () => props.node.location === "start" || props.node.location === "end",
);
</script>

<template>
    <Dockable.Border :node="node" :class="styles.border">
        <Dockable.TabList
            :aria-label="`${node.location} panels`"
            :class="styles.borderTabList"
        >
            <template #default="{ tab }">
                <!-- an icon-only tab is named by its tab's name; upright and centred in a side bar -->
                <Dockable.Tab
                    :node="tab"
                    :aria-label="side ? tab.label : undefined"
                    :class="styles.borderTab(side)"
                >
                    <Tooltip.Root v-if="side">
                        <Tooltip.Trigger
                            as="span"
                            :class="styles.borderTabTooltip"
                        >
                            <component
                                :is="BORDER_ICONS[tab.component]"
                                v-if="BORDER_ICONS[tab.component]"
                                aria-hidden="true"
                                :class="styles.borderTabIcon"
                            />
                        </Tooltip.Trigger>
                        <Tooltip.Content>{{ tab.label }}</Tooltip.Content>
                    </Tooltip.Root>
                    <template v-else>
                        <component
                            :is="BORDER_ICONS[tab.component]"
                            v-if="BORDER_ICONS[tab.component]"
                            aria-hidden="true"
                            :class="styles.borderTabIcon"
                        />
                        {{ tab.label }}
                    </template>
                </Dockable.Tab>
            </template>
        </Dockable.TabList>
    </Dockable.Border>
</template>
