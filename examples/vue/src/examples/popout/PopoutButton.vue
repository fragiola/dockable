<script setup lang="ts">
import { type TabsetNode, useDockable } from "@fragiola/dockable-vue";
import { ArrowDownToLine, SquareArrowOutUpRight } from "@lucide/vue";
import { computed } from "vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * `Dockable.PopoutTrigger` pops the selected tab out and, in a popout, docks it back into the main
 * layout's active tabset. It renders nothing when the tab cannot pop out (here "Pinned here"), and
 * says which way it goes with `data-mode` ("popout" or "dock"): the icons follow it.
 */
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
// a new tabset node (another selected tab) recomputes it
const name = computed(
    () =>
        model.get("selected-tab-by", { tabsetId: props.tabset.id })?.label ??
        "",
);
</script>

<template>
    <Dockable.PopoutTrigger :class="styles.popoutButton">
        <template #render="{ props: trigger, state, children }">
            <button
                v-bind="trigger"
                :aria-label="
                    state.mode === 'dock'
                        ? `Dock ${name} back`
                        : `Pop out ${name}`
                "
            >
                <component :is="children" />
            </button>
        </template>
        <SquareArrowOutUpRight aria-hidden="true" :class="styles.popoutIcon" />
        <ArrowDownToLine aria-hidden="true" :class="styles.dockIcon" />
    </Dockable.PopoutTrigger>
</template>
