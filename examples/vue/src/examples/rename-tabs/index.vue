<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { ref } from "vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Inline rename: double-click a tab (or press F2 on it) and type. Enter confirms, Escape cancels,
// an empty name is refused. The package has no rename UI: the name is the tab's `label`, and
// renaming is one command, `tab.rename` with the new label, whatever the tab's component.
// Whether a tab may be renamed is the tab's `renamable` (true unless set), and the model enforces it.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    {
                        component: "note",
                        label: "Untitled",
                        data: {
                            text: "Double-click a tab, or focus it and press F2, to rename it.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Sketch",
                        data: { kind: "area", seed: 5 },
                    },
                    {
                        component: "note",
                        label: "Fixed name",
                        // this one cannot be renamed: tab.rename refuses it
                        renamable: false,
                        data: {
                            text: "This tab keeps its name: it is renamable: false.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "kpi", label: "Ideas", data: { seed: 12 } },
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
// one tab at most is being renamed
const editing = ref<string | null>(null);
const setEditing = (id: string | null) => {
    editing.value = id;
};
</script>

<template>
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode
                        :node="node"
                        :editing="editing"
                        :set-editing="setEditing"
                    />
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
