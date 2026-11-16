<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import HairlineSplitter from "./hairline-splitter.vue";
import LayoutNode from "./layout-node.vue";
import * as styles from "./styles";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 25,
                children: [
                    {
                        component: "files",
                        label: "Explorer",
                        data: {
                            files: [
                                "src/main.ts",
                                "src/utils.ts",
                                "src/styles.css",
                                "package.json",
                                "tsconfig.json",
                            ],
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 75,
                children: [
                    {
                        type: "tabset",
                        weight: 70,
                        children: [
                            {
                                component: "source",
                                label: "main.ts",
                                data: {
                                    code: [
                                        'import { formatTotal } from "./utils";',
                                        "",
                                        "const orders = await fetchOrders();",
                                        "console.log(formatTotal(orders));",
                                    ].join("\n"),
                                },
                            },
                            {
                                component: "source",
                                label: "utils.ts",
                                data: {
                                    code: [
                                        "export function formatTotal(orders: Order[]) {",
                                        "    const total = orders.reduce((sum, o) => sum + o.amount, 0);",
                                        '    return "$" + total.toFixed(2);',
                                        "}",
                                    ].join("\n"),
                                },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 30,
                        children: [
                            {
                                component: "terminal",
                                label: "Terminal",
                            },
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
            <!-- every splitter of every row is the HairlineSplitter component -->
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <HairlineSplitter v-bind="props" />
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
