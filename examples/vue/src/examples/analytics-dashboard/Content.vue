<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartWidget from "./ChartWidget.vue";
import type { Types } from "./dockable";
import KpiWidget from "./KpiWidget.vue";
import OrdersWidget from "./OrdersWidget.vue";

// A tab's widget, picked by its `component` (`tab.data` narrows with it).
defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <ChartWidget v-if="tab.component === 'chart'" :tab="tab" />
    <KpiWidget v-else-if="tab.component === 'kpi'" :tab="tab" />
    <OrdersWidget v-else />
</template>
