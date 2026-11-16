<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { Tooltip } from "#/components/ui/tooltip";
import Content from "./content.vue";
import { Dockable, keyMap, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "documents",
                data: { name: "Documents" },
                weight: 55,
                children: [
                    { component: "keys", label: "Keys" },
                    {
                        component: "doc",
                        label: "Readme",
                        data: {
                            text: "Every part of the layout is reachable without a mouse: the tab strips, the splitters and each tab's content. The Keys tab lists them all.",
                        },
                    },
                    {
                        component: "doc",
                        label: "License",
                        data: {
                            text: "MIT. Permission is hereby granted, free of charge, to any person obtaining a copy of this software, to deal in the software without restriction.",
                        },
                        closable: false,
                    },
                ],
            },
            {
                type: "tabset",
                data: { name: "Tools" },
                weight: 45,
                children: [
                    { component: "table", label: "Search" },
                    { component: "log", label: "History" },
                ],
            },
        ],
    },
    active: "documents",
};

const model = createModel<Types>(json);
</script>

<template>
    <Tooltip.Provider>
        <div :class="styles.frame">
            <!-- the shortcuts of dockable.ts, merged over the defaults -->
            <Dockable.Root :model="model" :key-map="keyMap" :class="styles.root">
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
                        <div
                            v-bind="props"
                            :class="styles.dropIndicator(state)"
                        />
                    </template>
                </Dockable.DropIndicator>
            </Dockable.Root>
        </div>
    </Tooltip.Provider>
</template>
