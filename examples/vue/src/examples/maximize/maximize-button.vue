<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import { Maximize2, Minimize2 } from "@lucide/vue";
import { type Types, toggleMaximize } from "./dockable";
import * as styles from "./styles";

const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
const maximized = useModelState<Types, boolean>(() =>
    model.is("tabset-maximized", { tabsetId: props.tabset.id }),
);
// the model answers without running the command (a tabset alone in its layout cannot maximize)
const canMaximize = useModelState<Types, boolean>(() =>
    model.can("tabset.maximize", { tabsetId: props.tabset.id, value: true }),
);
</script>

<template>
    <button
        v-if="canMaximize"
        type="button"
        :aria-label="maximized ? 'Restore' : 'Maximize'"
        :aria-pressed="maximized"
        :class="styles.button"
        @click="toggleMaximize(model, tabset.id)"
    >
        <Minimize2 v-if="maximized" aria-hidden="true" :class="styles.buttonIcon" />
        <Maximize2 v-else aria-hidden="true" :class="styles.buttonIcon" />
    </button>
</template>
