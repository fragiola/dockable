<script setup lang="ts">
import {
    type CommandError,
    createModel,
    type LayoutJson,
} from "@fragiola/dockable-vue";
import { RotateCcw, Save, Upload } from "@lucide/vue";
import { ref } from "vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// versioned: a layout saved with an older registry (its "card" tabs) is not restored
const STORAGE_KEY = "dockable-example:save-restore:v3";

// Explicit ids: a reset or a restore keeps every tab whose id survives, content and all.
const defaultJson: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "welcome",
                        component: "doc",
                        label: "Welcome",
                        data: {
                            text: "Move tabs or drag a splitter, then save. Reset brings back the default layout; Restore loads the saved one.",
                        },
                    },
                    {
                        id: "notes",
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "The tabs have explicit ids: a reset or a restore keeps every tab whose id survives, content and all.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "json",
                        component: "json",
                        label: "Layout JSON",
                    },
                    {
                        id: "inspector",
                        component: "table",
                        label: "Inspector",
                    },
                ],
            },
        ],
    },
};

// Storage can throw (private mode, a full quota, storage disabled): never let it break the app.
// What comes back is untrusted text: `layout.load` validates it before anything changes.
function readSaved(): unknown {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        return text ? JSON.parse(text) : undefined;
    } catch {
        return undefined;
    }
}

function writeSaved(json: LayoutJson<Types>): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
        return true;
    } catch {
        return false;
    }
}

/** Why a stored layout was refused: the message and the JSON path of each problem. */
function describeError(error: CommandError): string {
    const issues = error.issues ?? [];
    if (issues.length === 0) {
        return error.message;
    }
    return issues
        .map((issue) => `${issue.path || "/"} ${issue.message}`)
        .join("; ");
}

// one model for the example's lifetime: restoring or resetting loads a layout into it
const model = createModel<Types>(defaultJson);
const status = ref("Move tabs or resize, then save.");

function save() {
    status.value = writeSaved(model.get("layout-json"))
        ? "Saved to localStorage."
        : "Could not save: storage is unavailable.";
}
function restore() {
    const saved = readSaved();
    if (saved === undefined) {
        status.value = "Nothing saved yet.";
        return;
    }
    // `dispatch` takes untrusted JSON: the stored layout is validated against JSON v1 (and
    // its ids checked) before it replaces the current one, in place
    const result = model.dispatch({
        command: "layout.load",
        payload: { layout: saved },
    });
    status.value = result.ok
        ? "Restored from localStorage."
        : `Could not restore: ${describeError(result.error)}`;
}
function reset() {
    model.run("layout.load", { layout: defaultJson });
    status.value = "Reset to the default layout.";
}
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.toolbar">
            <button type="button" :class="styles.primaryButton" @click="save">
                <Save aria-hidden="true" :class="styles.buttonIcon" />
                Save
            </button>
            <button type="button" :class="styles.button" @click="restore">
                <Upload aria-hidden="true" :class="styles.buttonIcon" />
                Restore
            </button>
            <button type="button" :class="styles.button" @click="reset">
                <RotateCcw aria-hidden="true" :class="styles.buttonIcon" />
                Reset
            </button>
            <output data-testid="status" :class="styles.status">{{ status }}</output>
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
    </div>
</template>
