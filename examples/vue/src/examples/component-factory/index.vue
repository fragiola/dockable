<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import { renderFactory, TEMPLATES } from "./factory";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Tabs whose `component` field selects their content (see factory.ts). Content renders on
// demand (`renderOnDemand` on `Dockable.Panels`, on by default): a tab's content mounts the first
// time it is shown and then stays mounted.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { ...TEMPLATES.chart, label: "Revenue" },
                    TEMPLATES.table,
                    {
                        component: "table",
                        label: "Pending",
                        data: { status: "Pending" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "markdown",
                        label: "README.md",
                        data: {
                            text: "# Component factory\nEach tab names a component and carries its data.\n- chart, table, markdown, form\n- add more with the + menu",
                        },
                    },
                    TEMPLATES.form,
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
</script>

<template>
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
                    <component :is="renderFactory(tab)" />
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
