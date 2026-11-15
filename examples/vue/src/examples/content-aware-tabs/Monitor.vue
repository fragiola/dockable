<script setup lang="ts">
import { type TabNode, useDockable } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/PanelBody.vue";
import { type MonitorData, STATUS, type Status, type Types } from "./dockable";
import * as styles from "./styles";

// Content that reports its status to its tab.
const props = defineProps<{ tab: TabNode<"monitor", MonitorData> }>();
const { model } = useDockable<Types>();
const statuses = Object.keys(STATUS) as Status[];

function report(status: Status) {
    const data = props.tab.data;
    if (status === data.status) {
        return;
    }
    // `tab.set-data` patches the data: the keys it passes change, the others stay
    model.run("tab.set-data", {
        tabId: props.tab.id,
        data: {
            status,
            incidents: data.incidents + (status === "healthy" ? 0 : 1),
        },
    });
}
</script>

<template>
    <PanelBody :title="`${tab.label} service`">
        <p :class="styles.monitorText">
            Set the service's health. The panel writes it into the tab's data
            with a command; the tab reads it back.
        </p>
        <fieldset :class="styles.statusList">
            <legend :class="styles.srOnly">Status</legend>
            <button
                v-for="status in statuses"
                :key="status"
                type="button"
                :aria-pressed="tab.data.status === status"
                :class="styles.statusButton(status, tab.data.status === status)"
                @click="report(status)"
            >
                {{ STATUS[status].text }}
            </button>
        </fieldset>
        <p :class="styles.incidents">
            {{ `Incidents so far: ${tab.data.incidents}` }}
        </p>
    </PanelBody>
</template>
