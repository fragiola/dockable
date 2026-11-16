<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Card from "../_kit/card.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// Pop a tab out into its own browser window, and back. The core opens the window (`popoutURL`,
// served under the site's base path), copies the page's styles into it and moves the tab's
// content element there: the counter and the notes keep their state both ways. Closing the window
// docks its tabs back into the main layout (the default "dock" policy). A tab can also be dragged
// from the window into the main layout, and back (see the popout-drag example).

const json: LayoutJson<Types> = {
    version: 1,
    // tabs may be popped out (off by default)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "card", label: "Editor" },
                    { component: "card", label: "Preview" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "card", label: "Chat" },
                    {
                        component: "card",
                        label: "Pinned here",
                        // this one stays in the main window
                        poppable: false,
                    },
                ],
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
                        <p :class="styles.panelText">
                            Count, type a note, then pop the tab out with the
                            button in its header. Dock it back from the window,
                            or close the window.
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
