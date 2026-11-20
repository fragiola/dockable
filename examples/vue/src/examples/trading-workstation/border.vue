<script setup lang="ts">
import type { BorderNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import TradingTab from "./trading-tab.vue";

/** The bottom border's strip: the account's tabs, which open a panel below the desk. */
defineProps<{ node: BorderNode<Types> }>();
</script>

<template>
    <Dockable.Border :node="node" :class="styles.border">
        <Dockable.TabList aria-label="Account" :class="styles.borderTabList">
            <template #default="{ tab }">
                <TradingTab :tab="tab" />
            </template>
        </Dockable.TabList>
    </Dockable.Border>
</template>
