<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Controls from "./controls.vue";
import Counter from "./counter.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Controls outside the layout drive what is inside it. The switcher above the layout selects a
// tab (`tab.select`) and follows the selection made by clicking a tab; the stepper changes the
// counter of the tab the user is looking at (`tab.set-data`). Both go through the model only.
//
// The count lives in the tab's typed data, not in the tab component's own state: that is what lets
// code outside the layout read and change it, and it moves with the tab and saves with the layout.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        id: "alpha",
                        component: "counter",
                        label: "Alpha",
                        data: { count: 0 },
                    },
                    {
                        id: "beta",
                        component: "counter",
                        label: "Beta",
                        data: { count: 0 },
                    },
                    {
                        id: "gamma",
                        component: "counter",
                        label: "Gamma",
                        data: { count: 0 },
                    },
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
</script>

<template>
    <Controls :model="model" />
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
                    <Counter :tab="tab" />
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
