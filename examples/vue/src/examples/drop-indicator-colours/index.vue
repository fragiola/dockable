<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import type { Region } from "./styles";
import * as styles from "./styles";

// The drop indicator is the app's to draw, from data. Here its colour says where a dragged tab
// would land, in two parts:
//
//   which region  each tabset has a colour family: Inbox green, Review orange, Archive purple,
//                 Trash red (a tabset made by a split is rose); the layout's edge is blue
//   which side    a drop into the tabset fills the outline, a drop beside it (an edge of the
//                 tabset) thickens the side it docks to, a drop at the layout's edge is striped
//
// Both are in the indicator's state, which its class reads: the targeted tabset
// (`targetTabsetId`), the side (`location`) and the kind of drop (`kind`).

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "inbox",
                        children: [
                            {
                                component: "kpi",
                                label: "Signups",
                                data: { seed: 5 },
                            },
                            {
                                component: "chart",
                                label: "Leads",
                                data: { kind: "line" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "review",
                        children: [
                            {
                                component: "chart",
                                label: "Pipeline",
                                data: { kind: "bar" },
                            },
                        ],
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "archive",
                        children: [
                            {
                                component: "chart",
                                label: "Q1 share",
                                data: { kind: "donut" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "trash",
                        children: [
                            {
                                component: "kpi",
                                label: "Churn",
                                data: { seed: 14 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The legend: what each colour and each pattern means. */
const REGIONS: { region: Region; label: string }[] = [
    { region: "inbox", label: "Inbox" },
    { region: "review", label: "Review" },
    { region: "archive", label: "Archive" },
    { region: "trash", label: "Trash" },
    { region: "edge", label: "Layout edge" },
];

const model = createModel<Types>(json);
</script>

<template>
    <div :class="styles.legend">
        <ul aria-label="Regions" :class="styles.legendList">
            <li
                v-for="{ region, label } in REGIONS"
                :key="region"
                :class="styles.legendItem"
            >
                <span aria-hidden="true" :class="styles.swatch(region)" />
                {{ label }}
            </li>
        </ul>
        <p :class="styles.legendHint">
            Filled: into the tabset. Thick side: beside it. Stripes: at the
            layout's edge.
        </p>
    </div>
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
