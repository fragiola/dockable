<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./Content.vue";
import { Dockable, type Status, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// The tab follows its content. The content writes what the tab needs to know into the tab's
// `data` (with a command, so it is in the model, the JSON and the undo history); the tab reads
// `tab.data`, typed by its component, and exposes it as its own `data-*` attributes for the styles.

const monitor = (name: string, status: Status, incidents = 0) => ({
    component: "monitor" as const,
    label: name,
    data: { status, incidents },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    monitor("API", "healthy"),
                    monitor("Database", "degraded", 2),
                    monitor("Queue", "healthy"),
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "document",
                        label: "README.md",
                        data: { dirty: false },
                    },
                    {
                        component: "document",
                        label: "notes.txt",
                        data: { dirty: false },
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
