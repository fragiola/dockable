<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { computed } from "vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import { ICONS } from "./tabs";

// A service tab shows its status three ways: `data-status` (for any stylesheet), a palette
// (colour) and a badge (the number of open alerts). The pinned overview tab is an icon.
const props = defineProps<{ tab: TabOf<Types> }>();
// only a service tab has a status: `tab.data` narrows on `tab.component`
const service = computed(() =>
    props.tab.component === "service" ? props.tab.data : undefined,
);
const status = computed(() => service.value?.status);
const alerts = computed(() => service.value?.alerts ?? 0);
</script>

<template>
    <!-- `data-status` drives what shows: the status colours the icon, a line on top and a badge. -->
    <Dockable.Tab :node="tab" :data-status="status" :class="styles.tab">
        <component
            :is="ICONS[tab.component]"
            aria-hidden="true"
            data-testid="tab-icon"
            :class="styles.tabIcon(status)"
        />
        <!-- a pinned tab is only its icon; the name stays for screen readers -->
        <span :class="styles.tabName(tab.pinned)">{{ tab.label }}</span>
        <span v-if="alerts > 0" :class="styles.alertsLabel">
            {{ `${alerts} open ${alerts === 1 ? "alert" : "alerts"}` }}
        </span>
        <span
            v-if="alerts > 0"
            data-testid="alert-count"
            aria-hidden="true"
            :class="styles.alertBadge(status)"
        >
            {{ alerts }}
        </span>
        <span aria-hidden="true" :class="styles.statusLine(status)" />
    </Dockable.Tab>
</template>
