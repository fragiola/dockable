<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { SERVICES, type Simulation } from "./simulation";
import * as styles from "./styles";
import { useSimulation } from "./use-simulation";

const STEPS = [
    "Acknowledge the page in the on-call channel",
    "Check the latest deploy of the failing service",
    "Roll back if the deploy is younger than an hour",
    "Scale out the service if CPU stays over 80%",
    "Write the timeline in the incident doc",
];

/** The incident runbook: a checklist whose ticks survive any move of the tab. */
const props = defineProps<{ simulation: Simulation }>();
const snapshot = useSimulation(props.simulation);
const done = shallowRef<ReadonlySet<number>>(new Set());
const failing = computed(() =>
    SERVICES.filter((s) => snapshot.value.services[s.id].level === "critical"),
);

function toggle(index: number) {
    const next = new Set(done.value);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    done.value = next;
}
</script>

<template>
    <div :class="styles.runbookPanel">
        <p :class="styles.incidentStatus(failing.length > 0)">
            {{
                failing.length > 0
                    ? `Active incident: ${failing.map((s) => s.name).join(", ")}`
                    : "No active incident."
            }}
        </p>
        <ol :class="styles.steps">
            <li v-for="(step, index) in STEPS" :key="step">
                <label :class="styles.stepLabel">
                    <input
                        type="checkbox"
                        :checked="done.has(index)"
                        :class="styles.stepCheck"
                        @change="toggle(index)"
                    />
                    <span :class="styles.stepText(done.has(index))">
                        {{ step }}
                    </span>
                </label>
            </li>
        </ol>
    </div>
</template>
