<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import EventLine from "./EventLine.vue";
import type { OpsEvent, Simulation } from "./simulation";
import * as styles from "./styles";
import { useSimulation } from "./useSimulation";

/** The event stream, newest last, following the end while it grows. */
const props = defineProps<{
    simulation: Simulation;
    /** keep only these levels (the incident timeline shows no info lines) */
    only?: OpsEvent["level"][];
}>();
const snapshot = useSimulation(props.simulation);
const shown = computed(() => {
    const { events } = snapshot.value;
    const only = props.only;
    return only ? events.filter((e) => only.includes(e.level)) : events;
});
const end = ref<HTMLLIElement | null>(null);
const last = computed(() => shown.value[shown.value.length - 1]?.id);

// follow the end when a line arrives (once rendered: `flush: "post"`)
function follow() {
    end.value?.scrollIntoView({ block: "nearest" });
}
onMounted(follow);
watch(last, follow, { flush: "post" });
</script>

<template>
    <ol :class="styles.eventsPanel">
        <EventLine v-for="event in shown" :key="event.id" :event="event" />
        <li ref="end" aria-hidden="true" />
    </ol>
</template>
