<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./Content.vue";
import DottedSplitter from "./DottedSplitter.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import * as styles from "./styles";

// A splitter with a handle drawn inside it: three dots, stacked along the bar. The splitter is
// `Dockable.Splitter` with children; the dots turn with it, read from the splitter's
// `data-orientation` by the `group-data-[orientation=…]/splitter:` classes, and they react to its
// hover and `data-dragging`. Nothing about the handle is the package's: it is markup and classes.

// One column beside a row of two: the splitters run both ways.
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    { component: "kpi", label: "Revenue", data: { seed: 3 } },
                    { component: "kpi", label: "Orders", data: { seed: 9 } },
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
                                component: "chart",
                                label: "Traffic",
                                data: { kind: "area" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "chart",
                                label: "Channels",
                                data: { kind: "bar" },
                            },
                            {
                                component: "chart",
                                label: "Share",
                                data: { kind: "pie" },
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
                    <DottedSplitter v-bind="props" />
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
