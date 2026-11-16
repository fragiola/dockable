<script setup lang="ts">
// Demo content: a Fragiola UI chart that fills its panel and follows the example theme.
import { computed, ref } from "vue";
import { Chart } from "#/components/ui/chart";
import { cn } from "#/lib/cn";
import { type ChartKind, chartOption, useChartKey } from "./charts";

const props = withDefaults(
    defineProps<{
        kind?: ChartKind;
        seed?: number;
        title?: string;
        class?: string;
    }>(),
    { kind: "line", seed: 7, title: undefined, class: undefined },
);
const element = ref<HTMLElement | null>(null);
const chartKey = useChartKey(element);
const option = computed(() => chartOption(props.kind, props.seed));
</script>

<template>
    <div
        ref="element"
        :class="cn('flex h-full min-h-40 flex-col p-3', props.class)"
    >
        <h2 v-if="props.title" class="px-1 pb-2 text-sm">{{ props.title }}</h2>
        <Chart
            v-if="chartKey !== null"
            :key="chartKey"
            :option="option"
            class="min-h-0 flex-1"
        />
    </div>
</template>
