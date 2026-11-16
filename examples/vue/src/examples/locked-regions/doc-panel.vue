<script setup lang="ts">
import { type TabOf, useDockable, useModelState } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/panel-body.vue";
import type { Types } from "./dockable";
import { REFERENCE } from "./regions";
import * as styles from "./styles";

/** The content of a document tab, with a button that tries to break the rule from code. */
const props = defineProps<{
    tab: Extract<TabOf<Types>, { component: "doc" }>;
}>();
const emit = defineEmits<{ notice: [notice: string | undefined] }>();
const { model } = useDockable<Types>();
// where the tab is follows the model (the panel's content does not re-render by itself)
const inReference = useModelState<Types, boolean>(
    (_state, model) =>
        model.get("node-parent-by", { nodeId: props.tab.id })?.id === REFERENCE,
);

// a command from code goes through the same middleware: the result says why it was refused
function moveToReference() {
    const result = model.run("tab.move", {
        tabId: props.tab.id,
        to: REFERENCE,
        location: "center",
        index: -1,
    });
    emit("notice", result.ok ? undefined : result.error.message);
}
</script>

<template>
    <PanelBody :title="tab.label">
        <p :class="styles.panelText">
            {{ `Region: ${tab.data.region}.` }}
            {{
                tab.data.region === REFERENCE
                    ? "This tab may be dropped into Reference."
                    : "Reference refuses this tab: try dragging it there."
            }}
        </p>
        <div v-if="tab.data.region !== REFERENCE && !inReference">
            <button
                type="button"
                :class="styles.button"
                @click="moveToReference"
            >
                Move to Reference from code
            </button>
        </div>
    </PanelBody>
</template>
