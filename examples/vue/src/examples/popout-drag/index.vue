<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Card from "../_kit/Card.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// Tabs move between windows like between tabsets: pop one out, then drag tabs into the window or
// out of it. The page's windows share one drag state, so a drag that starts in one window drops in
// another; each window draws its own outline (a DropIndicator inside Dockable.Popout, below).
// The content element moves with the tab, so the counter and the notes keep their values.

const card = (name: string) => ({ component: "card" as const, label: name });

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [card("Orders"), card("Customers"), card("Invoices")],
            },
            {
                type: "tabset",
                weight: 50,
                children: [card("Chart"), card("Notes")],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

const model = createModel<Types>(json);
</script>

<template>
    <div :class="styles.frame">
        <!-- popout-mirror-root copies <html> and <body>'s attributes (light/dark, the example
             theme) into each popout window, kept in sync -->
        <Dockable.Root
            :model="model"
            :popoutURL="popoutURL"
            popout-mirror-root
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
            <!-- Every tab's content, in this window or a popout, positioned by the engine. -->
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Card :name="tab.label">
                        <p :class="styles.panelHint">
                            Pop this tab out, then drag tabs into its window,
                            and back into this one.
                        </p>
                    </Card>
                </Dockable.Panel>
            </Dockable.Panels>
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
            <!-- Each popout window: its own floor, rows and drop outline, teleported into the
                 window once it is ready. -->
            <Dockable.Popout :class="styles.popout">
                <Dockable.Row>
                    <template #default="{ node }">
                        <LayoutNode :node="node" />
                    </template>
                    <template #splitter="{ props }">
                        <Splitter v-bind="props" />
                    </template>
                </Dockable.Row>
                <!-- a window shows its own outline during a drag into it -->
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
</template>
