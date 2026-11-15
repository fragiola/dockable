<script setup lang="ts">
import type { BorderNode, Model } from "@fragiola/dockable-vue";
import { computed } from "vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

const props = defineProps<{ model: Model<Types>; border: BorderNode<Types> }>();
// the border's mode, resolved against the layout defaults (a new border node on every change
// recomputes it)
const overlay = computed(() =>
    props.model.is("border-overlay", { borderId: props.border.id }),
);
const name = computed(() => props.border.location);

function toggle() {
    props.model.run("border.configure", {
        borderId: props.border.id,
        mode: overlay.value ? "docked" : "overlay",
    });
}
</script>

<template>
    <button
        type="button"
        :data-testid="`type-${name}`"
        :class="styles.modeButton"
        :aria-pressed="overlay"
        @click="toggle"
    >
        {{
            `${name[0]?.toUpperCase()}${name.slice(1)}: ${overlay ? "overlay" : "split"}`
        }}
    </button>
</template>
