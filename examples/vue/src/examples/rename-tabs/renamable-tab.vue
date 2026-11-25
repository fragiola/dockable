<script setup lang="ts">
import { type TabOf, useDockable } from "@fragiola/dockable-vue";
import RenameField from "../_kit/rename-field.vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

const props = defineProps<{
    tab: TabOf<Types>;
    editing: boolean;
    setEditing: (id: string | null) => void;
}>();
const { model } = useDockable<Types>();

// ask the model whether this tab may be renamed (its `renamable`, and any middleware)
function start() {
    if (
        model.can("tab.rename", { tabId: props.tab.id, label: props.tab.label })
    ) {
        props.setEditing(props.tab.id);
    }
}

function commit(name: string) {
    model.run("tab.rename", { tabId: props.tab.id, label: name });
    props.setEditing(null);
}
</script>

<template>
    <!-- the key map's rename key (F2): the tab emits rename-request when the model allows it -->
    <Dockable.Tab
        :node="tab"
        :class="styles.tab"
        @dblclick="start"
        @rename-request="start"
    >
        <RenameField
            v-if="editing"
            :name="tab.label"
            @commit="commit"
            @cancel="setEditing(null)"
        />
        <span v-else :class="styles.tabName">{{ tab.label }}</span>
    </Dockable.Tab>
</template>
