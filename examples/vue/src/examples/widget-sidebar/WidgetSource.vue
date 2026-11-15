<script setup lang="ts">
import type { Model } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import { type Widget, widgetTab } from "./widgets";

// A widget in the sidebar: drag it into the layout, or click it (keyboard: Enter) to add it.
const props = defineProps<{
    model: Model<Types>;
    widget: Widget;
    onAdded: (tab: string | undefined) => void;
}>();

// Native drag and drop has no keyboard path, so a click adds the widget to the active
// tabset. `tab.add` runs on the model, through its middleware, like the drop does.
const addToActiveTabset = () => {
    const target = props.model.get("default-tabset");
    if (!target) return;
    const added = props.model.run("tab.add", {
        ...widgetTab(props.widget),
        to: target.id,
        select: true,
    });
    props.onAdded(added.ok ? added.value.tabId : undefined);
};
</script>

<template>
    <Dockable.DragSource
        as="button"
        type="button"
        :model="model"
        :tab="() => widgetTab(widget)"
        :on-drop="onAdded"
        aria-description="Drag into the layout, or press to add to the active tabset"
        :class="styles.widget"
        @click="addToActiveTabset"
    >
        <span :class="styles.widgetIconBox">
            <component
                :is="widget.icon"
                aria-hidden="true"
                :class="styles.widgetIcon"
            />
        </span>
        <span :class="styles.widgetText">
            <span :class="styles.widgetTitle">{{ widget.title }}</span>
            <span :class="styles.widgetDescription">{{
                widget.description
            }}</span>
        </span>
    </Dockable.DragSource>
</template>
