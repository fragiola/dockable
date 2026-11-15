<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import LogPanel from "../_kit/LogPanel.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

// A tab's content: `tab.data` and the component narrow together.
defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <LogPanel v-if="tab.component === 'terminal'" />
    <ul v-else-if="tab.component === 'problems'" :class="styles.problems">
        <li
            v-for="item in tab.data.items"
            :key="item.where"
            :class="styles.problem"
        >
            <span :class="styles.problemWhere">{{ item.where }}</span>
            {{ item.message }}
        </li>
    </ul>
    <pre v-else :class="styles.source">{{ tab.data.text }}</pre>
</template>
