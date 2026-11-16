<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import { Pin, PinOff } from "@lucide/vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

// Pins or unpins the tabset's selected tab.
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
// the tab changes with the model (a pin, another selection): read it as model state
const selected = useModelState(() =>
    model.get("selected-tab-by", { tabsetId: props.tabset.id }),
);

function toggle() {
    const tab = selected.value;
    if (tab) {
        model.run("tab.pin", { tabId: tab.id, value: tab.pinned !== true });
    }
}
</script>

<template>
    <button
        v-if="selected"
        type="button"
        :aria-label="`${selected.pinned === true ? 'Unpin' : 'Pin'} ${selected.label}`"
        :aria-pressed="selected.pinned === true"
        :class="styles.button"
        @click="toggle"
    >
        <PinOff
            v-if="selected.pinned === true"
            aria-hidden="true"
            :class="styles.buttonIcon"
        />
        <Pin v-else aria-hidden="true" :class="styles.buttonIcon" />
    </button>
</template>
