<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { PanelBottom, PanelTop } from "@lucide/vue";
import { computed, ref } from "vue";
import Content from "./content.vue";
import { Dockable, type Position, type Types } from "./dockable";
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
                weight: 60,
                children: [
                    { component: "table", label: "Sheet 1" },
                    {
                        component: "chart",
                        label: "Sheet 2",
                        data: { kind: "bar", seed: 5 },
                    },
                    {
                        component: "chart",
                        label: "Sheet 3",
                        data: { kind: "donut", seed: 12 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "log", label: "Console" },
                    { component: "kpi", label: "Watch", data: { seed: 21 } },
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
const position = ref<Position>("bottom");
const bottom = computed(() => position.value === "bottom");
const positions = ["top", "bottom"] as const;
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.toolbar">
            <span :class="styles.toolbarLabel">Tabs</span>
            <button
                v-for="value in positions"
                :key="value"
                type="button"
                :aria-pressed="position === value"
                :class="styles.button"
                @click="position = value"
            >
                <PanelTop
                    v-if="value === 'top'"
                    aria-hidden="true"
                    :class="styles.buttonIcon"
                />
                <PanelBottom v-else aria-hidden="true" :class="styles.buttonIcon" />
                {{ value === "top" ? "Top" : "Bottom" }}
            </button>
        </div>
        <div :class="styles.frame">
            <Dockable.Root :model="model" :class="styles.root">
                <Dockable.Row>
                    <template #default="{ node }">
                        <LayoutNode :node="node" :position="position" />
                    </template>
                    <template #splitter="{ props }">
                        <Splitter v-bind="props" />
                    </template>
                </Dockable.Row>
                <Dockable.Panels v-slot="{ tab }">
                    <Dockable.Panel :node="tab" :class="styles.panel(bottom)">
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
