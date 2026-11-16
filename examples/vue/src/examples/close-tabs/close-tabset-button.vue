<script setup lang="ts">
import { type TabsetNode, useDockable } from "@fragiola/dockable-vue";
import { X } from "@lucide/vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
</script>

<template>
    <!-- closes every closeable tab; the tabset goes too once it is empty -->
    <button
        v-if="tabset.children.length > 0"
        type="button"
        aria-label="Close tabset"
        :class="styles.button"
        @click="model.run('tabset.close', { tabsetId: tabset.id })"
    >
        <X aria-hidden="true" :class="styles.buttonIcon" />
    </button>
</template>
