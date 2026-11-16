<script setup lang="ts">
import { type TabNode, useDockable } from "@fragiola/dockable-vue";
import { ref } from "vue";
import type { DocumentData, Types } from "./dockable";
import * as styles from "./styles";

// An editor that marks its tab as modified while its text differs from the saved one.
const props = defineProps<{ tab: TabNode<"document", DocumentData> }>();
const { model } = useDockable<Types>();
const saved = ref(`# ${props.tab.label}\n`);
const text = ref(saved.value);

function setDirty(dirty: boolean) {
    // only run the command when the flag changes, not on every keystroke
    if (props.tab.data.dirty !== dirty) {
        model.run("tab.set-data", { tabId: props.tab.id, data: { dirty } });
    }
}

function onInput(event: Event) {
    const { value } = event.currentTarget as HTMLTextAreaElement;
    text.value = value;
    setDirty(value !== saved.value);
}

function save() {
    saved.value = text.value;
    setDirty(false);
}
</script>

<template>
    <div :class="styles.editor">
        <textarea
            :aria-label="`${tab.label} text`"
            :value="text"
            :class="styles.editorText"
            @input="onInput"
        />
        <div>
            <button type="button" :class="styles.saveButton" @click="save">
                Save
            </button>
        </div>
    </div>
</template>
