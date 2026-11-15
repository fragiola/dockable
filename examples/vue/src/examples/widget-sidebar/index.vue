<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { ref } from "vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";
import WidgetContent from "./WidgetContent.vue";
import WidgetSource from "./WidgetSource.vue";
import { WIDGETS } from "./widgets";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [{ component: "revenue", label: "Revenue chart" }],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "orders", label: "Orders table" }],
            },
        ],
    },
};

const model = createModel<Types>(json);
const status = ref("");
// the new tab's id, or undefined when the add was refused
const onAdded = (id: string | undefined) => {
    const tab = id === undefined ? undefined : model.get("node-by", { id });
    status.value = tab?.type === "tab" ? `Added ${tab.label}` : "Nothing added";
};
</script>

<template>
    <div :class="styles.page">
        <aside aria-label="Widgets" :class="styles.sidebar">
            <h2 :class="styles.sidebarTitle">Widgets</h2>
            <ul :class="styles.widgetList">
                <li v-for="widget in WIDGETS" :key="widget.component">
                    <WidgetSource
                        :model="model"
                        :widget="widget"
                        :on-added="onAdded"
                    />
                </li>
            </ul>
            <p role="status" data-testid="status" :class="styles.status">
                {{ status }}
            </p>
        </aside>
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
                        <WidgetContent :tab="tab" />
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
