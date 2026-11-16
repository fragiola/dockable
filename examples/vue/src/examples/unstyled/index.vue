<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import Content from "./content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import * as styles from "./styles";

// The layout with no CSS: no primitive gets a class, and each renders a plain `div` with only
// structural inline styles (flex sizing, `position`, geometry, `display: none`). What you see is
// the browser's default rendering of that markup.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", label: "Welcome" },
                    { component: "card", label: "Notes" },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "card", label: "Inspector" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "card", label: "Output" }],
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
        <!-- The stage's theme sets an inherited font, colour and background: `all: initial` on
             this wrapper cuts that inheritance, so the layout below shows what the browser
             gives you with no CSS at all (black serif text on the canvas colour). It is the
             example's own element, not a Dockable primitive; an app would not need it. -->
        <div
            data-testid="unstyled-frame"
            :style="{
                all: 'initial',
                display: 'flex',
                flex: 1,
                minHeight: 0,
                background: 'Canvas',
                color: 'CanvasText',
            }"
        >
            <!-- Root is `position: relative`; it only needs a size to lay out in. -->
            <Dockable.Root :model="model" :style="{ flex: 1 }">
                <Dockable.Row>
                    <template #default="{ node }">
                        <LayoutNode :node="node" />
                    </template>
                    <!-- A splitter has no name of its own: `Row` inserts it, so this slot names it. -->
                    <template #splitter="{ props }">
                        <Dockable.Splitter v-bind="props" aria-label="Resize" />
                    </template>
                </Dockable.Row>
                <Dockable.Panels v-slot="{ tab }">
                    <Dockable.Panel :node="tab">
                        <Content :tab="tab" />
                    </Dockable.Panel>
                </Dockable.Panels>
            </Dockable.Root>
        </div>
    </div>
</template>
