<script setup lang="ts">
import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
} from "@fragiola/dockable-vue";
import { ChartLine, ScrollText, Table2 } from "@lucide/vue";
import { ref } from "vue";
import { Select } from "#/components/ui/select";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { component: "chart", label: "Revenue" },
                    { component: "table", label: "Orders" },
                ],
            },
        ],
    },
};

type Target = "active" | "end" | "bottom";

const TARGETS: { value: Target; label: string }[] = [
    { value: "active", label: "Active tabset" },
    { value: "end", label: "New tabset on the right" },
    { value: "bottom", label: "New tabset at the bottom" },
];

const KINDS = [
    { component: "chart", name: "Chart", icon: ChartLine },
    { component: "table", name: "Table", icon: Table2 },
    { component: "log", name: "Log", icon: ScrollText },
] as const;

const model = createModel<Types>(json);
const target = ref<Target>("active");
let count = 0;

// The toolbar is outside the layout: it runs commands on the model it owns, no engine needed.
const add = (kind: (typeof KINDS)[number]) => {
    count += 1;
    const tab = {
        component: kind.component,
        label: `${kind.name} ${count}`,
    };
    if (target.value === "active") {
        // into the active tabset (else the first), at the end (-1), and selected; with no
        // tabset left, into the layout itself: a new tabset
        model.run("tab.add", {
            ...tab,
            to: model.get("default-tabset")?.id ?? MAIN_LAYOUT,
            location: "center",
            index: -1,
            select: true,
        });
    } else {
        // dropped on an edge of the layout (its root row): a new tabset along that edge
        model.run("tab.add", {
            ...tab,
            to: MAIN_LAYOUT,
            location: target.value,
            select: true,
        });
    }
};
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.toolbar">
            <button
                v-for="kind in KINDS"
                :key="kind.component"
                type="button"
                :class="styles.button"
                @click="add(kind)"
            >
                <component
                    :is="kind.icon"
                    aria-hidden="true"
                    :class="styles.buttonIcon"
                />
                {{ `New ${kind.name.toLowerCase()}` }}
            </button>
            <span :class="styles.targetLabel">Add to</span>
            <Select.Root v-model="target" :items="TARGETS">
                <Select.Trigger
                    aria-label="Where to add"
                    data-testid="target"
                    :class="styles.targetSelect"
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item
                        v-for="item in TARGETS"
                        :key="item.value"
                        :value="item.value"
                    >
                        {{ item.label }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
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
