<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

const json: LayoutJson<Types> = {
    version: 1,
    // the active tabset when the layout loads (the layout's, by id)
    active: "editors",
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "editors",
                weight: 50,
                children: [
                    {
                        component: "doc",
                        label: "Editor",
                        data: {
                            text: "Revenue grew in every region this quarter, led by the new self-serve plan. The chart in Preview follows the figures as they are edited.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Preview",
                        data: { seed: 5 },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "doc",
                                label: "Outline",
                                data: {
                                    text: "Summary · Revenue · Customers · Outlook",
                                },
                            },
                            { component: "table", label: "Search" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Problems",
                                data: { seed: 13 },
                            },
                            { component: "log", label: "Output" },
                        ],
                    },
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
