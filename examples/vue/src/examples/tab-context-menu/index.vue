<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// A Fragiola ContextMenu on every tab (menu-tab.vue). The package provides the commands and
// `model.can`, which says whether a command would apply; the menu (and its text) is the
// consumer's.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "note",
                        label: "Overview",
                        data: {
                            text: "Right-click a tab (or long-press it) for its menu.",
                        },
                    },
                    {
                        component: "note",
                        label: "Settings",
                        data: {
                            text: "This tab cannot be closed: Close is disabled in its menu.",
                        },
                        // not closable: `tab.close` refuses it, so Close is disabled in its menu
                        closable: false,
                    },
                    { component: "log", label: "Activity" },
                    {
                        component: "chart",
                        label: "Reports",
                        data: { kind: "bar", seed: 21 },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "table", label: "Inbox" },
                    { component: "kpi", label: "Drafts", data: { seed: 6 } },
                ],
            },
        ],
    },
};

const model = createModel<Types>(json);
</script>

<template>
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
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
    </div>
</template>
