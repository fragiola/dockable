<script setup lang="ts">
import type { Model } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import { type Widget, widgetTab } from "./widgets";

const props = defineProps<{ model: Model<Types>; widget: Widget }>();
const tab = () => widgetTab(props.widget);
</script>

<template>
    <Dockable.DragSource
        :model="model"
        :tab="tab"
        as="li"
        :class="styles.paletteItem"
    >
        <component
            :is="widget.icon"
            aria-hidden="true"
            :class="styles.paletteItemIcon"
        />
        {{ widget.title }}
    </Dockable.DragSource>
</template>
