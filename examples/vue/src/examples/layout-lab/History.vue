<script setup lang="ts">
import { Redo2, Undo2 } from "@lucide/vue";
import { onUnmounted, shallowRef } from "vue";
import type { UndoManager } from "../_kit/undo";
import type { Types } from "./dockable";
import * as styles from "./styles";

const props = defineProps<{ undo: UndoManager<Types> }>();
const history = shallowRef(props.undo.getSnapshot());
onUnmounted(
    props.undo.subscribe(() => {
        history.value = props.undo.getSnapshot();
    }),
);
</script>

<template>
    <div :class="styles.history">
        <button
            type="button"
            aria-label="Undo"
            :disabled="!history.canUndo"
            :class="styles.undoButton"
            @click="undo.undo()"
        >
            <Undo2 aria-hidden="true" :class="styles.buttonIcon" />
        </button>
        <button
            type="button"
            aria-label="Redo"
            :disabled="!history.canRedo"
            :class="styles.redoButton"
            @click="undo.redo()"
        >
            <Redo2 aria-hidden="true" :class="styles.buttonIcon" />
        </button>
    </div>
</template>
