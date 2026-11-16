<script setup lang="ts">
import {
    type BatchEntry,
    createModel,
    type LayoutJson,
} from "@fragiola/dockable-vue";
import { Undo2 } from "@lucide/vue";
import { ref } from "vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// A control room: each tabset can go to its own window ("screen"), tabs can be dragged between
// the windows and the main layout, and "Bring everything back" docks every window's tabs into the
// main layout. Dockable.PopoutTrigger with target="tabset" does the sending; a batch of
// `window.close` commands the bringing back. `popout-mirror-root` mirrors the page's theme into
// each window.

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                data: { name: "Traffic" },
                weight: 40,
                children: [
                    { component: "requests", label: "Requests" },
                    { component: "latency", label: "Latency" },
                ],
            },
            {
                type: "row",
                weight: 60,
                children: [
                    {
                        type: "tabset",
                        data: { name: "Orders" },
                        children: [
                            { component: "orders", label: "Orders" },
                            { component: "refunds", label: "Refunds" },
                        ],
                    },
                    {
                        type: "tabset",
                        data: { name: "Events" },
                        children: [{ component: "events", label: "Events" }],
                    },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

const model = createModel<Types>(json);
const status = ref("");

// every window closes, and its tabs dock back into the main layout: one batch, one step
function bringBack() {
    const windows = model.get("windows");
    const panels = windows.flatMap((layout) =>
        model.get("tabs", { layoutId: layout.id }),
    );
    const commands = windows.map(
        (layout): BatchEntry<Types> => ({
            command: "window.close",
            payload: { windowId: layout.id },
        }),
    );
    if (commands.length > 0) {
        model.run("batch", { commands });
    }
    status.value = panels.length
        ? `Brought back ${panels.length} panel(s)`
        : "Nothing is on another screen";
}
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.toolbar">
            <p :class="styles.hint">
                Send a tabset to another screen with its monitor button, then
                drag panels between the windows.
            </p>
            <button type="button" :class="styles.button" @click="bringBack">
                <Undo2 aria-hidden="true" :class="styles.buttonIcon" />
                Bring everything back
            </button>
            <span role="status" data-testid="status" :class="styles.status">{{
                status
            }}</span>
        </div>
        <div :class="styles.frame">
            <!-- popout-mirror-root copies <html> and <body>'s attributes (light/dark, the example
                 theme) into each popout window, and keeps them in sync -->
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
                <!-- Every tab's content, in the main layout or in a window: the engine moves a
                     panel's element into the window its tab is in. -->
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
                <!-- Each window's layout: its own root element in the window's document, with
                     the same recursion as the main layout. -->
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
