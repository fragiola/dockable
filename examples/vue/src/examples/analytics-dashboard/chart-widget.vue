<script setup lang="ts">
import type { EChartsOption } from "echarts";
import { computed, ref } from "vue";
import { Chart } from "#/components/ui/chart";
import { useChartKey } from "../_kit/charts";
import { METRICS, months, type WidgetTab } from "./data";
import { useFilters } from "./filters";
import * as styles from "./styles";

// The widgets a tab can hold (ChartWidget, KpiWidget, OrdersWidget), chosen by the tab's
// `component` and configured by its `data`. They read the shared filters with `useFilters`: a
// teleport (the panel, or a popout window) keeps the injections of where it is declared.

/**
 * A Fragiola chart. The Line/Bar choice is local state: pop the tab out to another window and
 * it is still there, since the content moves with its tab instead of remounting.
 */
const props = defineProps<{ tab: WidgetTab<"chart"> }>();
const filters = useFilters();
const kind = ref<"line" | "bar">(props.tab.data.kind ?? "line");
const element = ref<HTMLElement | null>(null);
const chartKey = useChartKey(element);

const data = computed(() => METRICS[props.tab.data.metric](filters.value));
const option = computed<EChartsOption>(() => ({
    grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: {
        type: "category",
        data: months(filters.value),
        boundaryGap: kind.value === "bar",
    },
    yAxis: { type: "value", splitNumber: 3 },
    series: Object.entries(data.value).map(([name, values]) => ({
        name,
        type: kind.value,
        data: values,
        smooth: true,
        showSymbol: false,
        stack:
            kind.value === "bar" && props.tab.data.metric === "channels"
                ? "all"
                : undefined,
        barMaxWidth: 18,
    })),
}));
const total = computed(
    () => Object.values(data.value)[0]?.reduce((a, b) => a + b, 0) ?? 0,
);
</script>

<template>
    <div ref="element" :class="styles.chart">
        <div :class="styles.chartHeader">
            <span :class="styles.chartTotal">
                {{ `$${(total / 10).toFixed(1)}k` }}
            </span>
            <span
                v-for="(name, index) in Object.keys(data)"
                :key="name"
                :class="styles.legendItem"
            >
                <span
                    aria-hidden="true"
                    :class="styles.legendDot"
                    :style="{ background: `var(--chart-${index + 1})` }"
                />
                {{ name }}
            </span>
            <fieldset :class="styles.segments">
                <legend :class="styles.segmentsLegend">Chart type</legend>
                <button
                    v-for="value in ['line', 'bar'] as const"
                    :key="value"
                    type="button"
                    :aria-pressed="kind === value"
                    :class="styles.segment"
                    @click="kind = value"
                >
                    {{ value === "line" ? "Line" : "Bar" }}
                </button>
            </fieldset>
        </div>
        <Chart
            v-if="chartKey !== null"
            :key="chartKey"
            :option="option"
            :class="styles.chartCanvas"
        />
    </div>
</template>
