<script setup lang="ts">
import {
    createModel,
    type DropLocation,
    type LayoutJson,
} from "@fragiola/dockable-vue";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "@lucide/vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// Drag tabs between tabsets and to the layout's edges. The drop indicator is styled from its state:
// blue for a drop into a tabset (`kind: "rect"`), a dashed orange band for a drop at the layout's
// edge (`kind: "edge"`), an arrow for the side, and a transition as long as the root's
// `tabDragSpeed`. During a drag the edge indicators (Dockable.EdgeIndicator) mark the four bands
// where a drop docks to an edge.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Drag me",
                        data: { kind: "area", seed: 4 },
                    },
                    { component: "kpi", label: "Or me", data: { seed: 15 } },
                    {
                        component: "chart",
                        label: "Me too",
                        data: { kind: "donut", seed: 9 },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Inbox" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "log", label: "Outbox" }],
                    },
                ],
            },
        ],
    },
};

const ARROWS: Partial<Record<DropLocation, typeof ArrowUp>> = {
    top: ArrowUp,
    bottom: ArrowDown,
    start: ArrowLeft,
    end: ArrowRight,
};

const EDGES = [
    ["top", ArrowUp],
    ["bottom", ArrowDown],
    ["start", ArrowLeft],
    ["end", ArrowRight],
] as const;

const model = createModel<Types>(json);
</script>

<template>
    <div :class="styles.frame">
        <!-- tab-drag-speed: how long the indicator may take to move to the next target (exposed
             as data); while a tab of this layout is dragged, the panels fade back (styles.root) -->
        <Dockable.Root :model="model" :tab-drag-speed="0.2" :class="styles.root">
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
            <!-- Where a dragged tab would land, animated at the layout's drag speed. The render
                 slot gets the state too: an arrow for the side it docks to. -->
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div
                        v-bind="props"
                        :class="styles.dropIndicator(state)"
                        :style="{ transitionDuration: `${state.tabDragSpeed}s` }"
                    >
                        <component
                            :is="ARROWS[state.location]"
                            v-if="ARROWS[state.location]"
                            :class="styles.dropArrow"
                        />
                    </div>
                </template>
            </Dockable.DropIndicator>
            <!-- the edge docking targets, shown during a drag (solid under the pointer) -->
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
</template>
