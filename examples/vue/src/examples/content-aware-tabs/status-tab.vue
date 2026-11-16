<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { computed } from "vue";
import { Badge } from "#/components/atoms/badge";
import { Dockable, STATUS, type Types } from "./dockable";
import * as styles from "./styles";

// The tab: it only reads the data and turns it into `data-*` and a palette.
const props = defineProps<{ tab: TabOf<Types> }>();

/** What a tab shows about its content, read from its typed data. */
function tabState(tab: TabOf<Types>) {
    switch (tab.component) {
        case "monitor":
            return {
                status: tab.data.status,
                incidents: tab.data.incidents,
                dirty: false,
            };
        case "document":
            return { status: undefined, incidents: 0, dirty: tab.data.dirty };
    }
}

const shown = computed(() => {
    const { status: current, incidents, dirty } = tabState(props.tab);
    return {
        current,
        incidents,
        dirty,
        status: current ? STATUS[current] : undefined,
    };
});
</script>

<template>
    <Dockable.Tab
        :node="tab"
        :data-status="shown.current"
        :data-modified="shown.dirty ? '' : undefined"
        :class="styles.tab(shown.current)"
    >
        <component
            :is="shown.status.Icon"
            v-if="shown.status"
            aria-hidden="true"
            :class="styles.tabIcon"
        />
        <span :class="styles.tabName">{{ tab.label }}</span>
        <Badge
            v-if="shown.incidents"
            variant="solid"
            :aria-label="`${shown.incidents} incidents`"
            :class="styles.tabIncidents"
        >
            {{ shown.incidents }}
        </Badge>
        <!-- the "modified" dot; its text is for screen readers only -->
        <span v-if="shown.dirty" :class="styles.tabModified">
            <span :class="styles.srOnly">Modified</span>
        </span>
    </Dockable.Tab>
</template>
