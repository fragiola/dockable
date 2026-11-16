<script setup lang="ts">
import { useDockable } from "@fragiola/dockable-vue";
import { computed, ref, watchEffect } from "vue";
import { Badge } from "#/components/atoms/badge";
import { KPIS, kpiValue, type Types, type WidgetTab } from "./data";
import { useFilters } from "./filters";
import * as styles from "./styles";

/**
 * A KPI. It compares its value with a threshold and writes the result into its TAB's data
 * (the `tab.set-data` command), and the tab turns red: the tab follows its content.
 */
const props = defineProps<{ tab: WidgetTab<"kpi"> }>();
const filters = useFilters();
const { model } = useDockable<Types>();
const kpi = computed(() => KPIS[props.tab.data.metric]);
const threshold = ref<number>(kpi.value.threshold);
const value = computed(() => kpiValue(props.tab.data.metric, filters.value));
const status = computed(() => (value.value < threshold.value ? "alert" : "ok"));

// after the render (`flush: "post"`): a command changes the layout, never in the middle of one
watchEffect(
    () => {
        if (props.tab.data.status !== status.value) {
            model.run("tab.set-data", {
                tabId: props.tab.id,
                data: { status: status.value },
            });
        }
    },
    { flush: "post" },
);

function format(n: number) {
    return kpi.value.unit === "$"
        ? `$${n.toFixed(0)}`
        : `${n.toFixed(1)}${kpi.value.unit}`;
}

function onThreshold(event: Event) {
    threshold.value = Number((event.currentTarget as HTMLInputElement).value);
}
</script>

<template>
    <div :data-status="status" :class="styles.kpi">
        <p :class="styles.kpiTitle">{{ kpi.title }}</p>
        <p data-testid="kpi-value" :class="styles.kpiValue(status)">
            {{ format(value) }}
        </p>
        <div :class="styles.kpiFooter">
            <Badge variant="soft" :class="styles.kpiBadge(status)">
                {{ status === "alert" ? "Below target" : "On target" }}
            </Badge>
            <label :class="styles.kpiThreshold">
                Alert below
                <input
                    type="number"
                    :value="threshold"
                    :step="kpi.unit === '$' ? 5 : 0.1"
                    :class="styles.kpiInput"
                    @input="onThreshold"
                />
            </label>
        </div>
    </div>
</template>
