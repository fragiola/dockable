<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "@lucide/vue";
import { ref } from "vue";
import Border from "./Border.vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// A right-to-left page needs nothing from the layout: `dir="rtl"` on an ancestor of the root (here
// a wrapper; usually <html>) makes `start` the right side. The rows mirror (they are CSS flex), and
// the engine reads the root's direction, so splitters, arrow keys, side, edge and strip drops and
// overlay borders follow the screen. Flipping `dir` repositions the panels by itself.
//
// Two things stay yours: how a start border's labels read (its strip is on the right here, where
// labels read down, so it gets `tab-direction="down"`), and styles, written with logical
// properties (`ps-`, `border-e`, `start-`) so they mirror with the page.

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "start",
            selected: 0,
            children: [
                { component: "kpi", label: "Inbox", data: { seed: 11 } },
                { component: "kpi", label: "Sent", data: { seed: 23 } },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [{ component: "log", label: "Console" }],
        },
        {
            location: "end",
            mode: "overlay",
            children: [
                {
                    component: "doc",
                    label: "Notes",
                    data: {
                        text: "An overlay border on the end side: on the left in RTL, over the layout.",
                    },
                },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        component: "doc",
                        label: "Message",
                        data: {
                            text: "Start is on the right: this tabset comes first, and its first tab is the rightmost. Drag the splitter, or focus it and press the arrow keys: it moves the way they point. Drag a tab near the right edge to dock it at the start.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Calendar",
                        data: { kind: "bar" },
                    },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Contacts" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Traffic",
                                data: { kind: "line" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

// the edge docking targets; the start and end arrows turn with the page (`rtl:` in styles.ts)
const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["start", ArrowLeft],
    ["end", ArrowRight],
] as const;

const model = createModel<Types>(json);
const dir = ref<"rtl" | "ltr">("rtl");
</script>

<template>
    <div :dir="dir" :class="styles.page">
        <div :class="styles.toolbar">
            <button
                type="button"
                data-testid="direction"
                :class="styles.button"
                :aria-pressed="dir === 'rtl'"
                @click="dir = dir === 'rtl' ? 'ltr' : 'rtl'"
            >
                Right to left
            </button>
            <p dir="auto" :class="styles.hint">
                Toggle it: the panels follow the tabsets, and start switches
                sides.
            </p>
        </div>
        <div :class="styles.frame">
            <Dockable.Root :model="model" :class="styles.root">
                <Dockable.Borders>
                    <template #bar="{ border }">
                        <Border
                            :node="border"
                            :tab-direction="dir === 'rtl' ? 'down' : 'up'"
                        />
                    </template>
                    <template #content="{ border }">
                        <Dockable.BorderContent
                            :node="border"
                            :class="styles.borderContent"
                        >
                            <template #splitter="{ props }">
                                <Splitter v-bind="props" />
                            </template>
                        </Dockable.BorderContent>
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
                <Dockable.EdgeIndicator
                    v-for="[edge, Arrow] in EDGES"
                    :key="edge"
                    :edge="edge"
                    :class="styles.edgeIndicator"
                >
                    <component
                        :is="Arrow"
                        aria-hidden="true"
                        :class="styles.edgeArrow"
                    />
                </Dockable.EdgeIndicator>
            </Dockable.Root>
        </div>
    </div>
</template>
