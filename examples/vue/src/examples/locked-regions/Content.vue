<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/PanelBody.vue";
import DocPanel from "./DocPanel.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
defineEmits<{ notice: [notice: string | undefined] }>();
</script>

<template>
    <DocPanel
        v-if="tab.component === 'doc'"
        :tab="tab"
        @notice="$emit('notice', $event)"
    />
    <PanelBody v-else :title="tab.label">
        <p :class="styles.panelText">
            Locked in place: this tab cannot be dragged, and nothing can be
            dropped into or beside it.
        </p>
    </PanelBody>
</template>
