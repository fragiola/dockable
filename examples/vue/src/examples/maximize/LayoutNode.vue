<script setup lang="ts">
import {
    type RowNode,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-vue";
import { Dockable, type Types, toggleMaximize } from "./dockable";
import MaximizeButton from "./MaximizeButton.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

const props = defineProps<{ node: TabsetNode<Types> | RowNode<Types> }>();
const { model } = useDockable<Types>();

/**
 * A tabset: the strip and its maximize button on top, the measured content area below. The
 * maximized tabset is outlined and its header highlighted; a double-click on the header (not on
 * a tab or a button) toggles.
 */
function onDblclick(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('[role="tab"], button')) {
        toggleMaximize(model, props.node.id);
    }
}
</script>

<template>
    <Dockable.Row v-if="node.type === 'row'" :node="node">
        <template #default="{ node: child }">
            <LayoutNode :node="child" />
        </template>
        <template #splitter="{ props: splitter }">
            <Splitter v-bind="splitter" />
        </template>
    </Dockable.Row>
    <Dockable.TabSet v-else :node="node" :class="styles.tabset">
        <!-- a mouse shortcut; the button is the accessible way -->
        <div :class="styles.strip" @dblclick="onDblclick">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <span :class="styles.tabName">{{ tab.label }}</span>
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
            <div :class="styles.toolbar">
                <MaximizeButton :tabset="node" />
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
