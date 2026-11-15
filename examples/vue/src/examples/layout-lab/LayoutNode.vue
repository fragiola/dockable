<script setup lang="ts">
import {
    type RowNode,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-vue";
import { X } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

defineProps<{ node: TabsetNode<Types> | RowNode<Types> }>();
const { model } = useDockable<Types>();

function close(event: MouseEvent, tabId: string) {
    event.stopPropagation(); // a click on the tab would select it
    model.run("tab.close", { tabId });
}
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
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <span :class="styles.tabName">{{ tab.label }}</span>
                        <!-- a close button: one more command to watch in the log. The tab is the
                             tab stop (Ctrl+Delete on it closes it from the keyboard), and the
                             pointerdown is stopped so the press does not activate the tabset -->
                        <button
                            type="button"
                            tabindex="-1"
                            :aria-label="`Close ${tab.label}`"
                            :class="styles.tabClose"
                            @pointerdown.stop
                            @click="close($event, tab.id)"
                        >
                            <X aria-hidden="true" :class="styles.tabCloseIcon" />
                        </button>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
