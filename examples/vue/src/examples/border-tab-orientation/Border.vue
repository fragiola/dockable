<script setup lang="ts">
import type { BorderNode, ComponentOf } from "@fragiola/dockable-vue";
import { Bell, Bookmark, FileText, ListTree, Search } from "@lucide/vue";
import { computed } from "vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * A border's strip and its tabs. `data-orientation` is the direction its tabs run, `data-location`
 * the side it is on. The orientation toggle changes only their classes (`styles.border`,
 * `styles.borderTab`).
 */
const props = defineProps<{
    node: BorderNode<Types>;
    orientation: "vertical" | "horizontal";
}>();
const upright = computed(() => props.orientation === "horizontal");

// the side panels' icons, by component (the document tab has none)
const icons: { [K in ComponentOf<Types>]?: typeof ListTree } = {
    outline: ListTree,
    search: Search,
    bookmarks: Bookmark,
    notes: FileText,
    alerts: Bell,
};
</script>

<template>
    <Dockable.Border :node="node" :class="styles.border(upright)">
        <Dockable.TabList
            :aria-label="`${node.location} panels`"
            :class="styles.borderTabList"
        >
            <template #default="{ tab }">
                <Dockable.Tab :node="tab" :class="styles.borderTab(upright)">
                    <component
                        :is="icons[tab.component]"
                        v-if="icons[tab.component]"
                        aria-hidden="true"
                        :class="styles.labelIcon"
                    />
                    {{ tab.label }}
                </Dockable.Tab>
            </template>
        </Dockable.TabList>
    </Dockable.Border>
</template>
