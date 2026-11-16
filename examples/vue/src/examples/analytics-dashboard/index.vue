<script setup lang="ts">
import { createModel } from "@fragiola/dockable-vue";
import { onUnmounted, provide, ref, shallowRef } from "vue";
import { handleUndoKeys, UndoManager } from "../_kit/undo";
import Content from "./content.vue";
import { DEFAULT_FILTERS, type Filters, layout } from "./data";
import { Dockable, type Types } from "./dockable";
import { FiltersKey } from "./filters";
import Header from "./header.vue";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// A sales dashboard. The header (filters, "Add widget", undo/redo) lives outside the layout;
// each tab's `component` picks its widget; a KPI below target turns its tab red; any tabset
// can be maximized, and any widget popped out to a second screen with its state intact.

/** The popout host page, served next to the app under its base (Vite's `BASE_URL`). */
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

// The UndoManager records a step per command (`model.subscribe`); undo and redo load the saved
// JSON back into the same model (`layout.load`), which keeps every panel's content mounted.
// A KPI writing its status (`tab.set-data`) is not a layout change, so it records no undo step.
// Both are created once (never in a ref).
const model = createModel<Types>(layout);
const undo = new UndoManager(model, {
    ignoreCommands: ["tabset.activate", "window.configure", "tab.set-data"],
});
const history = shallowRef(undo.getSnapshot());
onUnmounted(
    undo.subscribe(() => {
        history.value = undo.getSnapshot();
    }),
);

// the shared filters, read by every widget (filters.ts)
const filters = ref<Filters>(DEFAULT_FILTERS);
provide(FiltersKey, filters);
</script>

<template>
    <!-- the undo shortcuts while focus is in the example -->
    <div :class="styles.frame" @keydown="handleUndoKeys(undo, $event)">
        <Header
            v-model:filters="filters"
            :model="model"
            :undo="undo"
            :history="history"
        />
        <div :class="styles.stage">
            <!-- `popout-mirror-root` copies <html> and <body>'s attributes (light/dark, the
                 example theme) into each popout window, kept in sync -->
            <Dockable.Root
                :model="model"
                :popoutURL="popoutURL"
                :popout-mirror-root="true"
                :class="styles.root"
            >
                <Dockable.Row>
                    <template #default="{ node }">
                        <LayoutNode :node="node" />
                    </template>
                    <template #splitter="{ props }">
                        <Splitter v-bind="props" />
                    </template>
                </Dockable.Row>
                <!-- Every widget, positioned by the engine over its tabset (or over the popout
                     window's tabset: the panel moves there, its state intact). -->
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
                <!-- A popped-out widget's window: its own row, with the same tabsets. -->
                <Dockable.Popout :class="styles.popout">
                    <Dockable.Row>
                        <template #default="{ node }">
                            <LayoutNode :node="node" />
                        </template>
                        <template #splitter="{ props }">
                            <Splitter v-bind="props" />
                        </template>
                    </Dockable.Row>
                    <Dockable.DropIndicator>
                        <template #render="{ props, state }">
                            <div
                                v-bind="props"
                                :class="styles.dropIndicator(state)"
                            />
                        </template>
                    </Dockable.DropIndicator>
                </Dockable.Popout>
            </Dockable.Root>
        </div>
    </div>
</template>
