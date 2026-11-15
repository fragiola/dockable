<script setup lang="ts">
import { type TabOf, useDockable } from "@fragiola/dockable-vue";
import { X } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

const props = defineProps<{ tab: TabOf<Types> }>();
const { model } = useDockable<Types>();

function close(event: MouseEvent) {
    event.stopPropagation(); // a click on the tab would select it
    model.run("tab.close", { tabId: props.tab.id });
}
</script>

<template>
    <Dockable.Tab :node="tab" :class="styles.tab">
        <span :class="styles.tabName">{{ tab.label }}</span>
        <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard; the
             pointerdown is stopped so the press does not activate the tabset -->
        <button
            type="button"
            tabindex="-1"
            :aria-label="`Close ${tab.label}`"
            :class="styles.closeButton"
            @pointerdown.stop
            @click="close"
        >
            <X aria-hidden="true" :class="styles.closeIcon" />
        </button>
    </Dockable.Tab>
</template>
