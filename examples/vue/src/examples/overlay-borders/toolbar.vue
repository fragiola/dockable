<script setup lang="ts">
import { type Model, useModelState } from "@fragiola/dockable-vue";
import { computed } from "vue";
import type { Types } from "./dockable";
import ModeSwitch from "./mode-switch.vue";
import * as styles from "./styles";

/** The toolbar outside the layout: it follows the borders, and a commit re-renders it, not the layout. */
const props = defineProps<{ model: Model<Types> }>();
const borders = useModelState(() => props.model.get("borders"), {
    model: props.model,
});

const SWITCHABLE = ["start", "bottom"] as const;

const switchable = computed(() =>
    SWITCHABLE.flatMap((location) => {
        const border = borders.value.find(
            (candidate) => candidate.location === location,
        );
        return border ? [border] : [];
    }),
);
</script>

<template>
    <div :class="styles.toolbar">
        <ModeSwitch
            v-for="border in switchable"
            :key="border.location"
            :model="model"
            :border="border"
        />
        <p :class="styles.hint">
            Drag a tab towards the right edge (above or below its middle) to
            reveal the hidden border.
        </p>
    </div>
</template>
