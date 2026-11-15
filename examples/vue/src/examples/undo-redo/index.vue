<script setup lang="ts">
import {
    type CommandName,
    createModel,
    type LayoutJson,
} from "@fragiola/dockable-vue";
import { Redo2, Undo2 } from "@lucide/vue";
import { computed, onMounted, onUnmounted, shallowRef } from "vue";
import { handleUndoKeys, UndoManager } from "../_kit/undo";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// Undo and redo with the examples' UndoManager (`_kit/undo.ts`: the package ships no undo). It
// listens to the model's commits (`model.subscribe`) and keeps the layout as it was before each
// step; undo and redo load it back into the same model (`layout.load`), so mounted content is
// kept. A splitter drag, many transient `row.resize` commands, is a single step.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "json", label: "Layout JSON" },
                    {
                        component: "doc",
                        label: "Welcome",
                        data: {
                            text: "Move a tab, drag a splitter, add or close tabs: each edit is a step in the history above.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "Selecting a tab or a tabset is navigation, not an edit: it adds no step.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Tasks",
                        data: { kind: "bar", seed: 4 },
                    },
                ],
            },
        ],
    },
};

// selecting a tab or a tabset is navigation, not an edit: it makes no undo step
const IGNORED: readonly CommandName[] = ["tabset.activate", "tab.select"];

// one model and one manager for the example's lifetime: undo and redo load a layout into the
// same model, so nothing is swapped
const model = createModel<Types>(json);
const undo = new UndoManager(model, { ignoreCommands: IGNORED });
const snapshot = shallowRef(undo.getSnapshot());
const unsubscribe = undo.subscribe(() => {
    snapshot.value = undo.getSnapshot();
});

// Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redoes
const onKeyDown = (event: KeyboardEvent) => handleUndoKeys(undo, event);
onMounted(() => document.addEventListener("keydown", onKeyDown));
onUnmounted(() => {
    document.removeEventListener("keydown", onKeyDown);
    unsubscribe();
});

const steps = computed(() => [
    ...snapshot.value.undoSteps.map((step) => ({
        name: describe(step.command),
        undone: false,
    })),
    // undone steps, oldest first, after the done ones
    ...[...snapshot.value.redoSteps].reverse().map((step) => ({
        name: describe(step.command),
        undone: true,
    })),
]);

/** A short name for a command, for the history list. */
function describe(command: CommandName): string {
    switch (command) {
        case "tab.add":
            return "Add tab";
        case "tab.close":
            return "Close tab";
        case "tab.move":
        case "tabset.move":
            return "Move";
        case "row.resize":
            return "Resize";
        case "tabset.maximize":
            return "Maximize";
        case "tab.rename":
            return "Rename";
        default:
            return command;
    }
}
</script>

<template>
    <div :class="styles.toolbar">
        <button
            type="button"
            :class="styles.button"
            :disabled="!snapshot.canUndo"
            aria-keyshortcuts="Control+Z Meta+Z"
            @click="undo.undo()"
        >
            <Undo2 aria-hidden="true" :class="styles.buttonIcon" />
            Undo
        </button>
        <button
            type="button"
            :class="styles.button"
            :disabled="!snapshot.canRedo"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            @click="undo.redo()"
        >
            <Redo2 aria-hidden="true" :class="styles.buttonIcon" />
            Redo
        </button>
        <ol aria-label="History" :class="styles.history">
            <li v-if="steps.length === 0" :class="styles.historyHint">
                Move, resize, add or close tabs: each edit is a step.
            </li>
            <!-- a list of steps in order: the index is the key -->
            <li
                v-for="(step, index) in steps"
                :key="index"
                :data-undone="step.undone ? '' : undefined"
                :class="styles.historyStep"
            >
                {{ step.name }}
            </li>
        </ol>
    </div>
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <Splitter v-bind="props" />
                </template>
            </Dockable.Row>
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Content :tab="tab" />
                </Dockable.Panel>
            </Dockable.Panels>
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
    </div>
</template>
