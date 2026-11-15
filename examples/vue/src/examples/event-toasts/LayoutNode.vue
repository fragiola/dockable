<script setup lang="ts">
import {
    type RowNode,
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import { Maximize2, Minimize2 } from "@lucide/vue";
import ClosableTab from "./ClosableTab.vue";
import { Dockable, type Types } from "./dockable";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

const props = defineProps<{ node: TabsetNode<Types> | RowNode<Types> }>();
const { model } = useDockable<Types>();

// A tabset: closable tabs, and a button that maximizes or restores it. Its state is read
// through useModelState, so the button follows the model.
const maximized = useModelState<Types, boolean>(
    () =>
        props.node.type === "tabset" &&
        model.is("tabset-maximized", { tabsetId: props.node.id }),
);
const canToggle = useModelState<Types, boolean>(
    () =>
        props.node.type === "tabset" &&
        model.can("tabset.maximize", {
            tabsetId: props.node.id,
            value: !model.is("tabset-maximized", { tabsetId: props.node.id }),
        }),
);

function toggle() {
    model.run("tabset.maximize", {
        tabsetId: props.node.id,
        value: !maximized.value,
    });
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
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <ClosableTab :tab="tab" />
                </template>
            </Dockable.TabList>
            <button
                v-if="canToggle"
                type="button"
                :aria-label="maximized ? 'Restore' : 'Maximize'"
                :class="styles.stripButton"
                @click="toggle"
            >
                <Minimize2 v-if="maximized" aria-hidden="true" :class="styles.icon" />
                <Maximize2 v-else aria-hidden="true" :class="styles.icon" />
            </button>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
