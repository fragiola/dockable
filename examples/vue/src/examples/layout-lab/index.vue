<script lang="ts">
/** Numbers the charts the Add tab button creates. */
let added = 0;
</script>

<script setup lang="ts">
import { createModel } from "@fragiola/dockable-vue";
import { Plus } from "@lucide/vue";
import { ref } from "vue";
import { CHART_KINDS } from "../_kit/charts";
import { UndoManager } from "../_kit/undo";
import Border from "./Border.vue";
import BorderContent from "./BorderContent.vue";
import CommandMonitor from "./CommandMonitor.vue";
import { initialLayout, type Veto } from "./commands";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import History from "./History.vue";
import LayoutNode from "./LayoutNode.vue";
import ModelEditor from "./ModelEditor.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";
import VetoControl from "./VetoControl.vue";

// The model is the source of truth, made visible. Left: the model's JSON (v1), editable (Apply
// loads it with the `layout.load` command, validated first). Right: the layout it renders. Below:
// every command a middleware (`model.use`) sees, and a switch that vetoes one command (the
// middleware returns `veto(…)`, the model does not change). Undo and redo load the previous layout
// back into the same model.

// one model for the lab's lifetime: Apply, undo and redo load a layout into it
const model = createModel<Types>(initialLayout);
const undo = new UndoManager(model);
const veto = ref<Veto>({ enabled: false, command: "tab.select" });

function addTab() {
    const target = model.get("default-tabset");
    if (!target) return;
    added += 1;
    // a chart, of the next kind each time
    model.run("tab.add", {
        component: "chart",
        label: `Chart ${added}`,
        data: { kind: CHART_KINDS[added % CHART_KINDS.length] ?? "line" },
        to: target.id,
    });
}
</script>

<template>
    <div :class="styles.lab">
        <ModelEditor :model="model" />
        <div :class="styles.main">
            <div :class="styles.toolbar">
                <History :undo="undo" />
                <button type="button" :class="styles.button" @click="addTab">
                    <Plus aria-hidden="true" :class="styles.buttonIcon" />
                    Add tab
                </button>
                <div :class="styles.vetoSlot">
                    <VetoControl
                        :veto="veto"
                        :commands="model.get('commands')"
                        @change="veto = $event"
                    />
                </div>
            </div>
            <div :class="styles.frame">
                <Dockable.Root :model="model" :class="styles.root">
                    <!-- The JSON may give the layout borders: they are drawn around it. -->
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
                            <div v-bind="props" :class="styles.dropIndicator(state)" />
                        </template>
                    </Dockable.DropIndicator>
                </Dockable.Root>
            </div>
            <CommandMonitor :model="model" :veto="veto" />
        </div>
    </div>
</template>
