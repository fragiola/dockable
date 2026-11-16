<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "@lucide/vue";
import Border from "./border.vue";
import BorderContent from "./border-content.vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";
import Toolbar from "./toolbar.vue";

// Overlay borders (`mode: "overlay"`) open over the layout instead of beside it, and close on a
// press elsewhere in the layout or on Escape (keyMap.closeOverlayBorder). The toolbar switches a
// border's mode with the `border.configure` command. The end border is empty and `autoHide`: it
// shows up while a tab is dragged near the layout's end edge, so it can take the drop. The edge
// indicators (Dockable.EdgeIndicator) mark where a drop docks to an edge instead.

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { border: { size: 240 } },
    borders: [
        {
            location: "start",
            mode: "overlay",
            children: [
                { component: "kpi", label: "Inbox", data: { seed: 17 } },
                {
                    component: "doc",
                    label: "Drafts",
                    data: {
                        text: "Hi team, the release notes are attached. Let me know before Friday if anything is missing.",
                    },
                },
            ],
        },
        {
            location: "bottom",
            mode: "overlay",
            size: 180,
            children: [{ component: "log", label: "Console" }],
        },
        {
            location: "end",
            autoHide: true,
            children: [],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "doc",
                        label: "Message",
                        data: {
                            text: "The left and bottom borders open over this layout without resizing it. Press elsewhere in the layout, or Escape, to close them.",
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
                type: "tabset",
                weight: 40,
                children: [{ component: "table", label: "Contacts" }],
            },
        ],
    },
};

// the four edge docking targets, each with an arrow pointing at its edge
const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["start", ArrowLeft],
    ["end", ArrowRight],
] as const;

const model = createModel<Types>(json);
</script>

<template>
    <div :class="styles.page">
        <Toolbar :model="model" />
        <div :class="styles.frame">
            <Dockable.Root :model="model" :class="styles.root">
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
                <!-- The band along each layout edge where a drop docks to that edge, shown
                     during a drag. -->
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
