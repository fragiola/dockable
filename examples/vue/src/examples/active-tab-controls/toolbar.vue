<script setup lang="ts">
import {
    type Model,
    type TabNode,
    useModelState,
} from "@fragiola/dockable-vue";
import {
    ChartArea,
    ChartColumn,
    ChartLine,
    ChartPie,
    Donut,
    Shuffle,
} from "@lucide/vue";
import { computed } from "vue";
import type { ChartKind } from "../_kit/charts";
import type { ChartData, Types } from "./dockable";
import * as styles from "./styles";

// The toolbar outside the layout: it follows the current tab, and a commit re-renders it, not the
// layout.
const props = defineProps<{ model: Model<Types> }>();

const KINDS: { kind: ChartKind; label: string; Icon: typeof ChartLine }[] = [
    { kind: "line", label: "Line", Icon: ChartLine },
    { kind: "area", label: "Area", Icon: ChartArea },
    { kind: "bar", label: "Bar", Icon: ChartColumn },
    { kind: "pie", label: "Pie", Icon: ChartPie },
    { kind: "donut", label: "Donut", Icon: Donut },
];

/** The tab the user is looking at: the selected tab of the active tabset (else the first). */
function currentTab(model: Model<Types>) {
    const tabset = model.get("default-tabset");
    return tabset
        ? model.get("selected-tab-by", { tabsetId: tabset.id })
        : undefined;
}

/** Changes some keys of a chart tab's data (`tab.set-data` keeps the others). */
function updateChart(
    model: Model<Types>,
    tab: TabNode<"chart", ChartData>,
    change: Partial<ChartData>,
) {
    model.run("tab.set-data", { tabId: tab.id, data: change });
}

const tab = useModelState(() => currentTab(props.model), {
    model: props.model,
});
const chart = computed(() =>
    tab.value?.component === "chart" ? tab.value : undefined,
);

function setKind(kind: ChartKind) {
    if (chart.value) updateChart(props.model, chart.value, { kind });
}

function newData() {
    if (chart.value) {
        updateChart(props.model, chart.value, {
            seed: chart.value.data.seed + 1,
        });
    }
}
</script>

<template>
    <div :class="styles.toolbar">
        <p role="status" data-testid="target" :class="styles.target">
            {{
                chart
                    ? `Editing ${chart.label}`
                    : `${tab?.label ?? "No tab"}: not a chart`
            }}
        </p>
        <fieldset
            aria-label="Chart kind"
            :disabled="!chart"
            :class="styles.segments"
        >
            <button
                v-for="{ kind, label, Icon } in KINDS"
                :key="kind"
                type="button"
                :aria-label="label"
                :aria-pressed="chart?.data.kind === kind"
                :class="styles.segment"
                @click="setKind(kind)"
            >
                <component
                    :is="Icon"
                    aria-hidden="true"
                    :class="styles.icon"
                />
            </button>
        </fieldset>
        <button
            type="button"
            :disabled="!chart"
            :class="styles.button"
            @click="newData"
        >
            <Shuffle aria-hidden="true" :class="styles.icon" />
            New data
        </button>
    </div>
</template>
