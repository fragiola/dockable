<script setup lang="ts">
import type { EChartsOption } from "echarts";
import { computed, ref } from "vue";
import { Chart } from "#/components/ui/chart";
import { useChartKey } from "../_kit/charts";
import { type Csv, numericColumns } from "./files";
import * as styles from "./styles";

// The CSV's numeric columns as bars, its first column as the labels.
const props = defineProps<{ csv: Csv }>();
const element = ref<HTMLElement | null>(null);
const chartKey = useChartKey(element);
const option = computed<EChartsOption>(() => ({
    grid: { left: 44, right: 16, top: 16, bottom: 48 },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    xAxis: {
        type: "category",
        data: props.csv.rows.map((row) => row[0] ?? ""),
    },
    yAxis: { type: "value" },
    series: numericColumns(props.csv).map((index) => ({
        type: "bar",
        name: props.csv.columns[index],
        data: props.csv.rows.map((row) => Number(row[index])),
    })),
}));
</script>

<template>
    <div ref="element" :class="styles.chart">
        <Chart
            v-if="chartKey !== null"
            :key="chartKey"
            :option="option"
            :class="styles.chartCanvas"
        />
    </div>
</template>
