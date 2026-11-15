<script setup lang="ts">
import type { DragSubject, Model, TabOf } from "@fragiola/dockable-vue";
import type { Component } from "vue";
import { Dockable, type Types } from "./dockable";
import type { Tone } from "./styles";
import * as styles from "./styles";

const props = defineProps<{
    id: string;
    model: Model<Types>;
    icon: Component;
    label: string;
    accepts: (tab: TabOf<Types>) => boolean;
    onDrop: (tab: TabOf<Types>) => void;
    tone: Tone;
}>();

/** The dragged tab of the layout, or undefined for a tabset or a new tab. */
function draggedTab(drag: DragSubject<Types>): TabOf<Types> | undefined {
    return drag.kind === "tab" ? drag.tab : undefined;
}

// the zones take tabs only
function takes(drag: DragSubject<Types>) {
    const tab = draggedTab(drag);
    return tab !== undefined && props.accepts(tab);
}

function drop(drag: DragSubject<Types>) {
    const tab = draggedTab(drag);
    if (tab) props.onDrop(tab);
}
</script>

<template>
    <Dockable.DropZone
        :model="model"
        :accepts="takes"
        :on-drop="drop"
        :data-testid="`zone-${id}`"
        :class="styles.zone(tone)"
    >
        <!-- the label right after the icon: no whitespace text before it -->
        <component
            :is="icon"
            aria-hidden="true"
            :class="styles.zoneIcon"
        />{{ label }}
    </Dockable.DropZone>
</template>
