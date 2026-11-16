<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import * as styles from "./styles";
import WideSplitter from "./wide-splitter.vue";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    {
                        component: "stats",
                        label: "Library",
                        data: { caption: "Words written", seed: 13 },
                    },
                ],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "draft",
                                label: "Draft",
                                data: {
                                    paragraphs: [
                                        "The harbour was quiet the morning the ferry did not come. Nobody said so at first; the gulls said it for them.",
                                        "By noon the café had run out of bread, and the conversation had moved from the weather to the mainland, and from the mainland to whoever had last seen the captain.",
                                    ],
                                },
                            },
                            {
                                component: "outline",
                                label: "Outline",
                                data: {
                                    headings: [
                                        "The missing ferry",
                                        "The café at noon",
                                        "The captain's house",
                                        "Night crossing",
                                    ],
                                },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "comments",
                                label: "Comments",
                                data: {
                                    comments: [
                                        {
                                            author: "Ada",
                                            text: "Lovely opening line.",
                                        },
                                        {
                                            author: "Grace",
                                            text: "Name the café?",
                                        },
                                        {
                                            author: "Alan",
                                            text: "The second paragraph could be split in two.",
                                        },
                                    ],
                                },
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
            <!-- every splitter of every row is the WideSplitter component -->
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <WideSplitter v-bind="props" />
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
