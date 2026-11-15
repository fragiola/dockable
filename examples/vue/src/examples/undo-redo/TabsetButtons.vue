<script lang="ts">
/** Numbers the tabs the add button creates. */
let added = 0;
</script>

<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import { Plus, X } from "@lucide/vue";
import { CHART_KINDS } from "../_kit/charts";
import type { Types } from "./dockable";
import * as styles from "./styles";

/** Add a tab to this tabset, and close its selected tab: two undoable edits. */
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
// read through useModelState: the buttons follow the model, not only their props
const selected = useModelState<Types, ReturnType<typeof selectedTab>>(() =>
    selectedTab(),
);
const closeable = useModelState<Types, boolean>(() => {
    const tab = selectedTab();
    return tab !== undefined && model.can("tab.close", { tabId: tab.id });
});

function selectedTab() {
    return model.get("selected-tab-by", { tabsetId: props.tabset.id });
}

function add() {
    added += 1;
    // a new chart, of the next kind in turn
    model.run("tab.add", {
        component: "chart",
        label: `Tab ${added}`,
        data: {
            kind: CHART_KINDS[added % CHART_KINDS.length] ?? "line",
            seed: added * 3,
        },
        to: props.tabset.id,
    });
}

function close() {
    const tab = selected.value;
    if (tab) {
        model.run("tab.close", { tabId: tab.id });
    }
}
</script>

<template>
    <button
        type="button"
        aria-label="Add tab"
        :class="styles.iconButton"
        @click="add"
    >
        <Plus aria-hidden="true" :class="styles.iconButtonIcon" />
    </button>
    <button
        type="button"
        aria-label="Close selected tab"
        :disabled="!closeable"
        :class="styles.iconButton"
        @click="close"
    >
        <X aria-hidden="true" :class="styles.iconButtonIcon" />
    </button>
</template>
