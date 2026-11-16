<script setup lang="ts">
import { type TabOf, useDockable } from "@fragiola/dockable-vue";
import { TriangleAlert, X } from "@lucide/vue";
import type { Types } from "./dockable";
import * as styles from "./styles";
import { ICONS, isAlert } from "./tabs";

// What goes inside each tab button: the widget's icon (or a warning), its name, a close button.
defineProps<{ tab: TabOf<Types> }>();
const { model } = useDockable<Types>();
</script>

<template>
    <TriangleAlert
        v-if="isAlert(tab)"
        role="img"
        aria-label="Below target"
        :class="styles.tabIcon"
    />
    <component
        :is="ICONS[tab.component]"
        v-else
        aria-hidden="true"
        :class="styles.tabIcon"
    />
    <span :class="styles.tabName">{{ tab.label }}</span>
    <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard (tabindex -1);
         the pointerdown stop keeps the press from activating the tabset, and the click stop
         keeps it from selecting the tab -->
    <button
        type="button"
        tabindex="-1"
        :aria-label="`Close ${tab.label}`"
        :class="styles.tabClose"
        @pointerdown.stop
        @click.stop="model.run('tab.close', { tabId: tab.id })"
    >
        <X aria-hidden="true" :class="styles.tabCloseIcon" />
    </button>
</template>
