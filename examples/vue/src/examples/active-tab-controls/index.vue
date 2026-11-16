<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";
import Toolbar from "./toolbar.vue";

// A toolbar outside the layout acts on the tab the user is looking at: the selected tab of the
// active tabset. Click another tabset and the toolbar follows it. What it changes (the chart's
// kind, its data) is the tab's typed data, patched with `tab.set-data`: the chart re-renders from
// it, and it would be saved with the layout. A table tab has nothing to drive: the toolbar says so.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar", seed: 3 },
                    },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "donut", seed: 5 },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line", seed: 9 },
                    },
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
</script>

<template>
    <Toolbar :model="model" />
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <Splitter v-bind="props" />
                </template>
            </Dockable.Row>
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Content :tab="tab" />
                </Dockable.Panel>
            </Dockable.Panels>
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
    </div>
</template>
