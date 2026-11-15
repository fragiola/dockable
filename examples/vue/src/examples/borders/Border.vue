<script setup lang="ts">
import type { BorderNode, TabOf } from "@fragiola/dockable-vue";
import { FileCode2, ListTree, Search, SquareTerminal } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/** A border's strip, with its tabs: a column on a side border. */
defineProps<{ node: BorderNode<Types> }>();

// an icon per border component (the editors have none)
const icons: Partial<Record<TabOf<Types>["component"], typeof ListTree>> = {
    explorer: ListTree,
    search: Search,
    terminal: SquareTerminal,
    outline: FileCode2,
};
</script>

<template>
    <Dockable.Border :node="node" :class="styles.border">
        <Dockable.TabList
            :aria-label="`${node.location} panels`"
            :class="styles.borderTabList"
        >
            <template #default="{ tab }">
                <Dockable.Tab :node="tab" :class="styles.borderTab">
                    <component
                        :is="icons[tab.component]"
                        v-if="icons[tab.component]"
                        aria-hidden="true"
                        :class="styles.borderTabIcon"
                    />
                    {{ tab.label }}
                </Dockable.Tab>
            </template>
        </Dockable.TabList>
    </Dockable.Border>
</template>
