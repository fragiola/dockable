<script setup lang="ts">
import { type TabNode, useDockable } from "@fragiola/dockable-vue";
import { computed, ref, watch } from "vue";
import type { Types } from "./dockable";
import * as styles from "./styles";
import type { EditorData, Workspace } from "./workspace";

// The content of each kind of tab. Panels are never remounted when their tab moves, so the
// editor keeps its text, caret and scroll through any drag.

/**
 * A plain-text editor. It reports "modified" to its TAB: the dirty flag goes into the tab's
 * `data` through the `tab.set-data` command, and the tab reads it back (`data-dirty`).
 * The text itself stays in the workspace, outside the model.
 */
const props = defineProps<{
    // an editor tab: `tab.data` is typed as the editor's data, no cast
    tab: TabNode<"editor", EditorData>;
    workspace: Workspace;
}>();
const { model } = useDockable<Types>();
const path = props.tab.data.path;
const text = ref(props.workspace.read(path));
// the workspace is not reactive: whether the file is modified is read again after each change
const dirty = ref(props.workspace.isDirty(path));
const refresh = () => {
    dirty.value = props.workspace.isDirty(path);
};

watch(
    [() => props.tab.data, dirty],
    ([data, isDirty]) => {
        if (Boolean(data.dirty) !== isDirty) {
            // a patch: the rest of the data (the path) stays
            model.run("tab.set-data", {
                tabId: props.tab.id,
                data: { dirty: isDirty },
            });
        }
    },
    { immediate: true },
);

const save = () => {
    props.workspace.save(path);
    refresh();
};
// an edit goes to the workspace's buffer
watch(text, (value) => {
    props.workspace.write(path, value);
    refresh();
});
const onKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        save();
    }
};
const parts = path.split("/");
const lineNumbers = computed(() =>
    Array.from({ length: text.value.split("\n").length }, (_, i) => i + 1).join(
        "\n",
    ),
);
</script>

<template>
    <div :class="styles.editor">
        <div :class="styles.breadcrumbs">
            <span v-for="(part, index) in parts" :key="part" :class="styles.crumb">
                <span v-if="index > 0" aria-hidden="true">›</span>
                <span :class="styles.crumbName(index === parts.length - 1)">
                    {{ part }}
                </span>
            </span>
            <button
                type="button"
                :disabled="!dirty"
                :class="styles.editorSave"
                @click="save"
            >
                {{ dirty ? "Save" : "Saved" }}
            </button>
        </div>
        <div :class="styles.editorBody">
            <pre aria-hidden="true" :class="styles.lineNumbers">{{ lineNumbers }}</pre>
            <textarea
                :aria-label="`Contents of ${path}`"
                data-testid="editor"
                v-model="text"
                wrap="off"
                :spellcheck="false"
                :class="styles.editorText"
                @keydown="onKeydown"
            />
        </div>
    </div>
</template>
