<script setup lang="ts">
import type { BorderNode } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/** A border's strip: its tabs, in a row or a column depending on its side. */
defineProps<{ node: BorderNode<Types> }>();
</script>

<template>
    <Dockable.Border :node="node" :class="styles.border">
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
