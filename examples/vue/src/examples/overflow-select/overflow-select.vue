<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-vue";
import { Select } from "#/components/ui/select";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

// The tabs that do not fit, listed in a Select whose trigger is the package's overflow trigger.
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
const { hiddenTabs } = useTabOverflow(() => props.tabset);

// the Select never holds a value (`null`): picking a tab selects it in the model
function onPick(id: unknown) {
    if (typeof id === "string") {
        model.run("tab.select", { tabId: id });
    }
}
</script>

<template>
    <Select.Root :model-value="null" @update:model-value="onPick">
        <!-- the package's trigger (measured, shown only while tabs are hidden), rendered as the
             Select's trigger -->
        <Dockable.TabOverflowTrigger
            :as="Select.Trigger"
            :aria-label="`${hiddenTabs.length} more tabs`"
            :class="styles.overflowTrigger"
        >
            {{ `+${hiddenTabs.length}` }}
        </Dockable.TabOverflowTrigger>
        <Select.Content>
            <Select.Item v-for="tab in hiddenTabs" :key="tab.id" :value="tab.id">
                {{ tab.label }}
            </Select.Item>
        </Select.Content>
    </Select.Root>
</template>
