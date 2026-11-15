<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <Dockable.Tab :node="tab" :class="styles.tab">
        <span :class="styles.tabName">{{ tab.label }}</span>
    </Dockable.Tab>
</template>
