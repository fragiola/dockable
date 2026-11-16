<script setup lang="ts">
import type { TabsetNode } from "@fragiola/dockable-vue";
import { AppWindow, ArrowDownToLine, SquareArrowOutUpRight } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/** Two triggers: the selected tab, and the whole tabset. Each docks back from a window. */
defineProps<{ tabset: TabsetNode<Types> }>();
</script>

<template>
    <Dockable.PopoutTrigger data-testid="popout-tab" :class="styles.windowButton">
        <template #render="{ props, state, children }">
            <button
                v-bind="props"
                :aria-label="
                    state.mode === 'dock'
                        ? 'Dock the tab back'
                        : 'Pop out the tab'
                "
            >
                <component :is="children" />
            </button>
        </template>
        <SquareArrowOutUpRight aria-hidden="true" :class="styles.popoutIcon" />
        <ArrowDownToLine aria-hidden="true" :class="styles.dockIcon" />
    </Dockable.PopoutTrigger>
    <!-- one trigger per tabset is enough in a window: the tab trigger docks back -->
    <Dockable.PopoutTrigger
        v-if="tabset.children.length > 1"
        target="tabset"
        data-testid="popout-tabset"
        :class="styles.tabsetWindowButton"
    >
        <template #render="{ props, state, children }">
            <button
                v-bind="props"
                :aria-label="
                    state.mode === 'dock'
                        ? 'Dock the whole tabset back'
                        : 'Pop out the whole tabset'
                "
            >
                <component :is="children" />
            </button>
        </template>
        <AppWindow aria-hidden="true" :class="styles.tabsetIcon" />
    </Dockable.PopoutTrigger>
</template>
