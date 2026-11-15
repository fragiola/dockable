<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/PanelBody.vue";
import CommandConsole from "./CommandConsole.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// The layout as data an assistant can drive: every change is a named command with a JSON Schema,
// so a script, a test, a chat assistant or this console can run it by name plus JSON. The console
// beside the layout lists the commands (`model.get("commands")`), runs one typed as JSON
// (`model.dispatch`), shows its result or its structured error, and logs every change
// (`model.subscribe`).

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "left",
                weight: 55,
                children: [
                    {
                        id: "readme",
                        component: "note",
                        label: "Readme",
                        data: {
                            text: "Run a command from the console: select, move or add a tab.",
                        },
                    },
                    {
                        id: "todo",
                        component: "note",
                        label: "Todo",
                        data: {
                            text: "Every change the console makes goes through the same bus as a drag.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 45,
                children: [
                    {
                        id: "ideas",
                        component: "note",
                        label: "Ideas",
                        data: {
                            text: "Hand the commands to an assistant as tools.",
                        },
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
                        <PanelBody :title="tab.label">
                            <p :class="styles.panelText">{{ tab.data.text }}</p>
                            <p :class="styles.panelId">{{ `id: ${tab.id}` }}</p>
                        </PanelBody>
                    </Dockable.Panel>
                </Dockable.Panels>
                <Dockable.DropIndicator>
                    <template #render="{ props, state }">
                        <div v-bind="props" :class="styles.dropIndicator(state)" />
                    </template>
                </Dockable.DropIndicator>
            </Dockable.Root>
        </div>
        <!-- outside the root: the console talks to the model only -->
        <CommandConsole :model="model" />
    </div>
</template>
