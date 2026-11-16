<script setup lang="ts">
import { type TabOf, useDockable, useModelState } from "@fragiola/dockable-vue";
import {
    Calendar,
    FileText,
    House,
    type LucideIcon,
    Mail,
    X,
} from "@lucide/vue";
import { computed } from "vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

// The inside of a tab: an icon when pinned (the name is kept for screen readers).
const props = defineProps<{ tab: TabOf<Types> }>();
const { model } = useDockable<Types>();

const ICONS: Record<string, LucideIcon> = {
    home: House,
    mail: Mail,
    calendar: Calendar,
};

const Icon = computed(() => ICONS[props.tab.data.icon ?? ""] ?? FileText);
// asked again whenever the model changes (pinning makes a tab unclosable)
const closeable = useModelState<Types, boolean>(() =>
    model.can("tab.close", { tabId: props.tab.id }),
);

function close(event: MouseEvent) {
    event.stopPropagation(); // a click on the tab would select it
    model.run("tab.close", { tabId: props.tab.id });
}
</script>

<template>
    <template v-if="tab.pinned === true">
        <component :is="Icon" aria-hidden="true" :class="styles.tabIcon" />
        <span :class="styles.tabNameHidden">{{ tab.label }}</span>
    </template>
    <template v-else>
        <span :class="styles.tabName">{{ tab.label }}</span>
        <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard; the
             stopped pointerdown keeps the press from activating the tabset -->
        <button
            v-if="closeable"
            type="button"
            tabindex="-1"
            :aria-label="`Close ${tab.label}`"
            :class="styles.closeButton"
            @pointerdown.stop
            @click="close"
        >
            <X aria-hidden="true" :class="styles.closeIcon" />
        </button>
    </template>
</template>
