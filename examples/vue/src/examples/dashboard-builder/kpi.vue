<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { computed } from "vue";
import { series } from "../_kit/charts";
import type { Types } from "./dockable";
import * as styles from "./styles";

const props = defineProps<{ tab: TabOf<Types> }>();
const values = computed(() =>
    series(props.tab.component === "kpi-revenue" ? 3 : 9, 8, 1000),
);
const last = computed(() => values.value.at(-1) ?? 0);
const change = computed(() => {
    const previous = values.value.at(-2) ?? 1;
    return ((last.value - previous) / Math.max(previous, 1)) * 100;
});
const up = computed(() => change.value >= 0);
const value = computed(() =>
    props.tab.component === "kpi-revenue"
        ? `$${last.value}k`
        : `${(last.value / 100).toFixed(1)}%`,
);
</script>

<template>
    <div :class="styles.kpi">
        <p :class="styles.kpiLabel">{{ tab.label }}</p>
        <p :class="styles.kpiValue">{{ value }}</p>
        <p :class="styles.kpiChange(up)">
            {{ `${up ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs last month` }}
        </p>
    </div>
</template>
