<script setup lang="ts">
import {
    createModel,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable-vue";
import { ExternalLink, PanelRight, Trash2 } from "@lucide/vue";
import { ref } from "vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";
import Zone from "./zone.vue";

// Drop zones: elements outside the layout that take a dragged tab. While a drag the zone takes is
// in progress it has `data-drop-active`; while the pointer is over it, `data-drop-over` (and the
// layout hides its outline). A drop calls `onDrop` with what is dragged: nothing moves by itself,
// the zone runs the command it stands for on the model (so its middleware sees it).

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "table", label: "Inbox" },
                    {
                        component: "note",
                        label: "Drafts",
                        data: {
                            text: "Reply to Grace about the pending order, and send Alan his invoice.",
                        },
                    },
                    // cannot be closed: the trash does not take it
                    {
                        component: "note",
                        label: "Pinned note",
                        data: {
                            text: "This tab cannot be closed: the trash does not take it.",
                        },
                        closable: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Calendar",
                        data: { seed: 11 },
                    },
                    { component: "kpi", label: "Contacts", data: { seed: 6 } },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`): the Pop out
// zone opens a tab in a window.
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

const model = createModel<Types>(json);
const status = ref("Drag a tab onto a zone below.");

// the zones live outside Dockable.Root: they run commands on the model itself
const report = (ok: boolean, describe: string) => {
    if (ok) status.value = describe;
};

function openToTheRight(tab: TabOf<Types>) {
    const root = model.get("root-row");
    if (!root) return;
    // the end edge of the root row (the right in LTR): a new tabset there
    report(
        model.run("tab.move", {
            tabId: tab.id,
            to: root.id,
            location: "end",
        }).ok,
        `Moved ${tab.label} to the right`,
    );
}
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.frame">
            <!-- popout-mirror-root: copies <html> and <body>'s attributes (light/dark, the example
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
                <!-- a popped-out tab's window: its own layout, and its own outline -->
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
        <div :class="styles.zones">
            <!-- Close: only tabs that may be closed -->
            <Zone
                :model="model"
                id="close"
                :icon="Trash2"
                label="Close"
                tone="danger"
                :accepts="(tab) => model.can('tab.close', { tabId: tab.id })"
                :on-drop="
                    (tab) =>
                        report(
                            model.run('tab.close', { tabId: tab.id }).ok,
                            `Closed ${tab.label}`,
                        )
                "
            />
            <Zone
                :model="model"
                id="right"
                :icon="PanelRight"
                label="Open to the right"
                tone="blue"
                :accepts="() => true"
                :on-drop="openToTheRight"
            />
            <Zone
                :model="model"
                id="popout"
                :icon="ExternalLink"
                label="Pop out"
                tone="green"
                :accepts="(tab) => model.can('tab.popout', { tabId: tab.id })"
                :on-drop="
                    (tab) =>
                        report(
                            model.run('tab.popout', { tabId: tab.id }).ok,
                            `Popped out ${tab.label}`,
                        )
                "
            />
            <p role="status" data-testid="status" :class="styles.status">
                {{ status }}
            </p>
        </div>
    </div>
</template>
