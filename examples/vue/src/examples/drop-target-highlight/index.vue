<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// No drop outline at all (the root has no `Dockable.DropIndicator`): the targets show themselves.
// While a drag would drop into (or beside) a tabset, it has `data-drop-target` and
// `data-drop-location` (center, top, bottom, start, end); a drop into its tab strip also gives the
// insertion index. The styles read only those: a layer in the tabset, above its panel, fills the
// part the drop would take, and a caret marks the insertion point in the strip.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 40,
                children: [
                    {
                        component: "chart",
                        label: "Alpha",
                        data: { kind: "line", seed: 3 },
                    },
                    { component: "kpi", label: "Beta", data: { seed: 11 } },
                    {
                        component: "chart",
                        label: "Gamma",
                        data: { kind: "pie", seed: 17 },
                    },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Delta",
                                data: { kind: "bar", seed: 8 },
                            },
                            { component: "table", label: "Epsilon" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Zeta",
                                data: { seed: 25, unit: "$" },
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
            <!-- no Dockable.DropIndicator: the highlights in TabSet.vue replace the outline -->
        </Dockable.Root>
    </div>
</template>
