<script setup lang="ts">
import { type TabsetNode, useDockable } from "@fragiola/dockable-vue";
import { MonitorDown, MonitorUp } from "@lucide/vue";
import { computed } from "vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * In the main layout, sends the whole tabset to a window; in a window, brings its selected tab
 * back to the main screen.
 */
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
const name = computed(() => props.tabset.data?.name ?? "panel");
// a tabset sent to a window is rendered there by a new ScreenButton: each reads it once
const inWindow = computed(() =>
    model.is("node-in-window", { nodeId: props.tabset.id }),
);
</script>

<template>
    <Dockable.PopoutTrigger
        v-if="inWindow"
        aria-label="Back to the main screen"
        data-testid="back"
        :class="styles.screenButton"
    >
        <MonitorDown aria-hidden="true" :class="styles.actionIcon" />
    </Dockable.PopoutTrigger>
    <Dockable.PopoutTrigger
        v-else
        target="tabset"
        :aria-label="`Move ${name} to another screen`"
        data-testid="move-tabset"
        :class="styles.screenButton"
    >
        <MonitorUp aria-hidden="true" :class="styles.actionIcon" />
    </Dockable.PopoutTrigger>
</template>
