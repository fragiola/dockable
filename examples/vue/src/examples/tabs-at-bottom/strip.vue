<script setup lang="ts">
import { Dockable } from "./dockable";
import * as styles from "./styles";

// The tabset's strip, above or below its content.
defineProps<{ bottom: boolean }>();
</script>

<template>
    <div :class="styles.strip(bottom)">
        <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
            <template #default="{ tab }">
                <Dockable.Tab :node="tab" :class="styles.tab(bottom)">
                    <span :class="styles.tabName">{{ tab.label }}</span>
                </Dockable.Tab>
            </template>
        </Dockable.TabList>
    </div>
</template>
