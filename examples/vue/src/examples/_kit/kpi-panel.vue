<script setup lang="ts">
// Demo content: a KPI. A figure, its change since last month (green up, red down) and a sparkline
// of the last eight months, all from one seed.
import { computed, ref } from "vue";
import { Chart } from "#/components/ui/chart";
import { cn } from "#/lib/cn";
import { MONTHS, series, sparklineOption, useChartKey } from "./charts";

const props = withDefaults(
    defineProps<{
        label: string;
        seed?: number;
        unit?: string;
        class?: string;
    }>(),
    { seed: 7, unit: "", class: undefined },
);
const element = ref<HTMLElement | null>(null);
const chartKey = useChartKey(element);
const values = computed(() => series(props.seed, MONTHS.length, 1000));
const last = computed(() => values.value.at(-1) ?? 0);
const delta = computed(() => {
    const previous = values.value.at(-2) ?? 0;
    return previous === 0
        ? 0
        : Math.round(((last.value - previous) / previous) * 100);
});
const option = computed(() => sparklineOption(values.value));
</script>

<template>
    <div
        ref="element"
        :class="cn('flex h-full min-h-32 flex-col justify-center gap-1 p-4', props.class)"
    >
        <span class="text-sm text-palette-accent/85">{{ props.label }}</span>
        <span class="flex items-baseline gap-2">
            <span class="text-3xl font-semibold tabular-nums">{{
                `${props.unit}${last.toLocaleString("en-US")}`
            }}</span>
            <span
                :class="
                    cn(
                        'rounded-full bg-palette-base px-2 py-0.5 text-xs font-medium tabular-nums text-palette-contrast',
                        delta >= 0 ? 'palette-green' : 'palette-danger',
                    )
                "
                >{{ `${delta >= 0 ? "+" : ""}${delta}%` }}</span
            >
        </span>
        <Chart
            v-if="chartKey !== null"
            :key="chartKey"
            :option="option"
            class="h-24 max-h-[50%] min-h-12"
        />
    </div>
</template>
