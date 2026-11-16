<script setup lang="ts">
import type { TabsetNode } from "@fragiola/dockable-vue";
import { Lock } from "@lucide/vue";
import { computed } from "vue";
import { Tooltip } from "#/components/ui/tooltip";
import type { Types } from "./dockable";
import { LOCKED, REFERENCE } from "./regions";
import * as styles from "./styles";

/** A lock on locked tabsets, with a Fragiola tooltip saying why. */
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const why = computed(() =>
    props.tabset.id === REFERENCE
        ? "Only reference tabs can be dropped here"
        : "Nothing can be dropped here, and its tabs stay put",
);
</script>

<template>
    <Tooltip.Root v-if="LOCKED.has(tabset.id)">
        <Tooltip.Trigger :aria-label="`Locked: ${why}`" :class="styles.lockBadge">
            <Lock aria-hidden="true" :class="styles.lockIcon" />
        </Tooltip.Trigger>
        <Tooltip.Content>{{ why }}</Tooltip.Content>
    </Tooltip.Root>
</template>
