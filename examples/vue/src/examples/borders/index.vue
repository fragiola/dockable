<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Border from "./border.vue";
import BorderContent from "./border-content.vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Borders are part of the model (`borders` in its JSON): a strip of tabs on one side of the
// layout, whose selected tab opens a panel beside it. Dockable.Borders (the frame) places them
// around the main layout, Dockable.Border (the strip) holds a border's tabs and
// Dockable.BorderContent (the panel area and its splitter) is where its panel opens; open one,
// resize it, or drag a tab between a border and the tabsets.

// What the two editor tabs show.
const APP_SOURCE = `import { createStore } from "./store";

export function createApp(root: HTMLElement) {
    const store = createStore({ theme: "light" });
    render(root, store.state);
    return { store, mount: () => render(root, store.state) };
}`;

const STORE_SOURCE = `export function createStore<S>(initial: S) {
    let state = initial;
    const listeners = new Set<(state: S) => void>();
    return {
        get state() { return state; },
        set(next: S) {
            state = next;
            for (const listener of listeners) listener(state);
        },
        subscribe: (listener: (state: S) => void) => listeners.add(listener),
    };
}`;

const json: LayoutJson<Types> = {
    version: 1,
    // every border's panel size, unless the border sets its own
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "start",
            selected: 0,
            children: [
                { component: "explorer", label: "Explorer" },
                { component: "search", label: "Search" },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [
                { component: "terminal", label: "Terminal" },
                { component: "terminal", label: "Output" },
            ],
        },
        {
            location: "end",
            children: [{ component: "outline", label: "Outline" }],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        component: "editor",
                        label: "app.ts",
                        data: { source: APP_SOURCE },
                    },
                    {
                        component: "editor",
                        label: "store.ts",
                        data: { source: STORE_SOURCE },
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
            <!-- The model's borders around the main layout: each one's strip, and the area
                 where its selected tab's panel opens. -->
            <Dockable.Borders>
                <template #bar="{ border }">
                    <Border :node="border" />
                </template>
                <template #content="{ border }">
                    <BorderContent :node="border" />
                </template>
                <Dockable.Row>
                    <template #default="{ node }">
                        <LayoutNode :node="node" />
                    </template>
                    <template #splitter="{ props }">
                        <Splitter v-bind="props" />
                    </template>
                </Dockable.Row>
            </Dockable.Borders>
            <!-- Every tab's content, the borders' too, positioned by the engine. -->
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
