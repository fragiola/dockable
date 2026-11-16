<script setup lang="ts">
import type { BorderNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/** A border's strip. The start border's labels read down on the right, up on the left. */
defineProps<{ node: BorderNode<Types>; tabDirection: "up" | "down" }>();
</script>

<template>
    <Dockable.Border
        :node="node"
        :tab-direction="tabDirection"
        :class="styles.border"
    >
        <Dockable.TabList
            :aria-label="`${node.location} panels`"
            :class="styles.borderTabList"
        >
            <template #default="{ tab }">
                <Dockable.Tab :node="tab" :class="styles.borderTab">
                    {{ tab.label }}
                </Dockable.Tab>
            </template>
        </Dockable.TabList>
    </Dockable.Border>
</template>
