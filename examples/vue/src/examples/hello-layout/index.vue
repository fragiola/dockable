<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Card from "../_kit/Card.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// A layout is JSON: rows split space, tabsets hold tabs. Weights are relative sizes.
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", label: "Welcome" },
                    { component: "card", label: "Notes" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "card", label: "Inspector" }],
            },
        ],
    },
};

// The model is the source of truth: create it once (never in a ref), the layout renders from it.
const model = createModel<Types>(json);
</script>

<template>
    <!-- The root needs a size: the wrapper gives it one, and the gutter around it. -->
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <!-- The layout's rows and tabsets: the developer owns the recursion. -->
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <Splitter v-bind="props" />
                </template>
            </Dockable.Row>
            <!-- Every tab's content, positioned by the engine over its tabset. -->
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Card :name="tab.label" />
                </Dockable.Panel>
            </Dockable.Panels>
            <!-- Where a dragged tab would land; its look depends on its state. -->
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
    </div>
</template>
