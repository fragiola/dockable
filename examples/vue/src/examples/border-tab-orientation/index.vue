<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { ref } from "vue";
import Border from "./Border.vue";
import BorderContent from "./BorderContent.vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// A side border's tabs read vertically here by default (writing-mode, and half a turn more on a
// start border that reads "up"; see Border.vue). Nothing in the package imposes it:
// Dockable.Border only lays its tab list out as a column, and exposes `data-orientation` and
// `data-tab-direction` for your CSS. The toggle below swaps class names, nothing else.

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "start",
            selected: 0,
            children: [
                {
                    component: "outline",
                    label: "Outline",
                    data: {
                        headings: ["Summary", "Revenue", "Orders", "Outlook"],
                    },
                },
                {
                    component: "search",
                    label: "Search",
                    data: {
                        query: "revenue",
                        results: [
                            "Summary: revenue grew for a third month",
                            "Revenue: by month",
                            "Outlook: revenue targets",
                        ],
                    },
                },
                {
                    component: "bookmarks",
                    label: "Bookmarks",
                    data: { pages: ["Revenue by month", "Refunded orders"] },
                },
            ],
        },
        {
            location: "end",
            children: [
                {
                    component: "notes",
                    label: "Notes",
                    data: {
                        text: "Check the June figures against the payment provider before sharing.",
                    },
                },
                { component: "alerts", label: "Alerts" },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        component: "document",
                        label: "Document",
                        data: {
                            summary:
                                "Revenue grew for a third month in a row, led by search and direct traffic. Refunds stayed under two percent of orders.",
                            kind: "bar",
                        },
                    },
                ],
            },
        ],
    },
};

type Orientation = "vertical" | "horizontal";

const model = createModel<Types>(json);
const orientation = ref<Orientation>("vertical");
const ORIENTATIONS = ["vertical", "horizontal"] as const;
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.toolbar">
            <fieldset :class="styles.toggleGroup">
                <legend :class="styles.legend">Side border labels</legend>
                <button
                    v-for="value in ORIENTATIONS"
                    :key="value"
                    type="button"
                    :data-testid="`labels-${value}`"
                    :aria-pressed="orientation === value"
                    :class="styles.toggle"
                    @click="orientation = value"
                >
                    {{
                        value === "vertical"
                            ? "Vertical labels"
                            : "Horizontal labels"
                    }}
                </button>
            </fieldset>
        </div>
        <div :class="styles.frame">
            <Dockable.Root :model="model" :class="styles.root">
                <Dockable.Borders>
                    <template #bar="{ border }">
                        <Border :node="border" :orientation="orientation" />
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
    </div>
</template>
