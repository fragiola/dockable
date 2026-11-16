<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Fragiola palettes, scoped per tabset. A palette class sets six roles (base, soft, line,
// contrast, accent, ring) as CSS variables, and every `bg-palette-*`/`text-palette-*` inside
// reads them. Each tabset keeps its palette in its `data` (through the `tabset.configure` command,
// so it is saved with the layout); the tabset's element takes the class.
//
// A coloured palette's `base` is a strong fill, so the tabset uses the pairs its roles are made
// for: `soft` behind `accent` text, and the selected tab as a `base` chip with `contrast` text.
// The palettes and the menu are in palettes.ts and palette-menu.vue.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                data: { palette: "palette-blue" },
                children: [
                    {
                        component: "chart",
                        label: "Trend",
                        data: { kind: "area" },
                    },
                    {
                        component: "note",
                        label: "Notes",
                        data: {
                            text: "Pick a palette from the tabset's menu: the tabs, this panel and its charts take its colours.",
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        data: { palette: "palette-orange" },
                        children: [{ component: "log", label: "Alerts" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Plain",
                                data: { seed: 6 },
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
