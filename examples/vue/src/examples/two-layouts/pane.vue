<script setup lang="ts">
import type { Model } from "@fragiola/dockable-vue";
import Card from "../_kit/card.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";

// One of the two layouts, with its own model.
defineProps<{ title: string; model: Model<Types> }>();
</script>

<template>
    <section
        :aria-label="title"
        :data-testid="`pane-${title.toLowerCase()}`"
        :class="styles.pane"
    >
        <h2 :class="styles.paneTitle">{{ title }}</h2>
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
                        <Card :name="tab.label" />
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
    </section>
</template>
