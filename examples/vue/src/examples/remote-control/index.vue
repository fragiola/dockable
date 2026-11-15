<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import RemotePanel from "./RemotePanel.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// The layout driven from code. The panel on the left lists the tabsets and their tabs
// (`model.get("tabsets")`, re-read on every commit) and runs commands on the tab you are looking
// at and its tabset. Each button asks the model first: `model.check` is the dry run of the same
// command, so a refused one is disabled and says why (a pinned tab cannot close or move, the
// right tabset cannot close, a tabset alone in its layout cannot maximize). The last result shows
// below. Nothing here touches the DOM: the layout follows the model.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "left",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Overview",
                        data: { kind: "area" },
                        pinned: true,
                    },
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 50,
                closable: false,
                children: [
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "donut" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line" },
                    },
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
</script>

<template>
    <div :class="styles.page">
        <RemotePanel :model="model" />
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
    </div>
</template>
