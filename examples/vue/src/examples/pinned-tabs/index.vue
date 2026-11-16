<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Pinned tabs: kept at the start of the strip by the model, shown as icons, and not closable
// (`model.can("tab.close", …)` refuses a pinned tab). The styles read `data-pinned` on the tab.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "chart",
                        label: "Home",
                        pinned: true,
                        data: {
                            icon: "home",
                            kind: "area",
                            seed: 4,
                        },
                    },
                    {
                        component: "table",
                        label: "Mail",
                        pinned: true,
                        data: { icon: "mail" },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: {
                            icon: "calendar",
                            kind: "bar",
                            seed: 12,
                        },
                    },
                    {
                        component: "chart",
                        label: "Report.pdf",
                        data: { kind: "donut", seed: 8 },
                    },
                    {
                        component: "kpi",
                        label: "Budget.xlsx",
                        data: { seed: 15, unit: "$" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    {
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "Pin or unpin the selected tab with the pin button in the header.",
                        },
                    },
                    {
                        component: "doc",
                        label: "Drafts",
                        data: {
                            text: "A pinned tab moves to the start of the strip and loses its close button.",
                        },
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
