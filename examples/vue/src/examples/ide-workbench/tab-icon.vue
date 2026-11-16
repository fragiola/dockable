<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { Bug, SquareTerminal } from "@lucide/vue";
import type { Types } from "./dockable";
import FileIcon from "./file-icon.vue";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <FileIcon v-if="tab.component === 'editor'" :path="tab.data.path" />
    <SquareTerminal
        v-else-if="tab.component === 'terminal'"
        aria-hidden="true"
        :class="styles.tabIcon"
    />
    <Bug v-else aria-hidden="true" :class="styles.tabIcon" />
</template>
