<script setup lang="ts">
import type { RowSplitterProps } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * A wide splitter: the element is 12px thick, and the engine measures it, so the panes leave that
 * much room between them and the whole bar is a grab area. The `render` slot hands over the
 * separator's props, `aria-valuetext` included: while you drag or focus it, a bubble shows where
 * the splitter sits in its row.
 */
defineProps<RowSplitterProps<Types>>();
</script>

<template>
    <Dockable.Splitter :node="node" :index="index" aria-label="Resize">
        <template #render="{ props: separator, state }">
            <div v-bind="separator" :class="styles.splitter(state)">
                <span
                    aria-hidden="true"
                    data-testid="splitter-readout"
                    :class="styles.splitterReadout"
                >
                    {{ separator["aria-valuetext"] }}
                </span>
            </div>
        </template>
    </Dockable.Splitter>
</template>
