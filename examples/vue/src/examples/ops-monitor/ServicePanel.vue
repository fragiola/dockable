<script setup lang="ts">
import { type TabNode, useDockable } from "@fragiola/dockable-vue";
import type { EChartsOption } from "echarts";
import { computed, ref, watchEffect } from "vue";
import { Badge } from "#/components/atoms/badge";
import { Chart } from "#/components/ui/chart";
import { useChartKey } from "../_kit/charts";
import type { ServiceData, Types } from "./dockable";
import { type Simulation, THRESHOLDS } from "./simulation";
import * as styles from "./styles";
import { useSimulation } from "./useSimulation";

/**
 * One service, live. When its alert level changes it writes the level into its TAB's data
 * (the `tab.set-data` command); the tab reads it back and recolours. Only on a change, not on
 * every sample, so the model sees a handful of commands, not one a second.
 */
const props = defineProps<{
    tab: TabNode<"service", ServiceData>;
    simulation: Simulation;
}>();
const { model } = useDockable<Types>();
const snapshot = useSimulation(props.simulation);
const state = computed(() => snapshot.value.services[props.tab.data.service]);
const element = ref<HTMLElement | null>(null);
const chartKey = useChartKey(element);

// after the render (`flush: "post"`): a command changes the layout, never in the middle of one
watchEffect(
    () => {
        const config = props.tab.data;
        const { level, alerts } = state.value;
        if (config.status !== level || config.alerts !== alerts) {
            model.run("tab.set-data", {
                tabId: props.tab.id,
                data: { status: level, alerts },
            });
        }
    },
    { flush: "post" },
);

const option = computed<EChartsOption>(() => ({
    animation: false,
    grid: {
        left: 4,
        right: 12,
        top: 12,
        bottom: 4,
        containLabel: true,
    },
    xAxis: {
        type: "category",
        show: false,
        data: state.value.latency.map((_, i) => i),
    },
    yAxis: {
        type: "value",
        splitNumber: 3,
        max: (v) => Math.max(1000, v.max),
    },
    series: [
        {
            type: "line",
            data: state.value.latency,
            showSymbol: false,
            areaStyle: { opacity: 0.15 },
            markLine: {
                silent: true,
                symbol: "none",
                label: { show: false },
                lineStyle: { type: "dashed" },
                data: [
                    { yAxis: THRESHOLDS.warning },
                    { yAxis: THRESHOLDS.critical },
                ],
            },
        },
    ],
}));
const latest = computed(
    () => state.value.latency[state.value.latency.length - 1] ?? 0,
);
const metrics = computed(() => [
    ["p95", `${latest.value} ms`],
    ["errors", `${state.value.errors}%`],
    ["cpu", `${state.value.cpu}%`],
]);
</script>

<template>
    <div ref="element" :class="styles.servicePanel">
        <div :class="styles.metrics">
            <Badge
                data-testid="service-status"
                :class="styles.statusBadge(state.level)"
            >
                {{ state.level }}
            </Badge>
            <span
                v-for="[term, value] in metrics"
                :key="term"
                :class="styles.metric"
            >
                <span :class="styles.metricTerm">{{ term }}</span>
                <span :class="styles.metricValue">{{ value }}</span>
            </span>
        </div>
        <div v-if="chartKey !== null" :class="styles.chartArea(state.level)">
            <!-- keyed on the theme and the level: the Fragiola chart reads its colours when it
                 mounts, so a palette change remounts it too -->
            <Chart
                :key="`${chartKey}-${state.level}`"
                :option="option"
                :class="styles.chart"
            />
        </div>
    </div>
</template>
