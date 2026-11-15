<script setup lang="ts">
import type {
    CommandError,
    CommandResult,
    LayoutJson,
    ValidationIssue,
} from "@fragiola/dockable-vue";
import { computed, ref, shallowRef, useId } from "vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

// The lab's two instruments, both outside the layout: the model's JSON (v1), editable (this
// component), and the log of every command the lab's middleware saw (CommandLog.vue), with a
// switch that vetoes one command (VetoControl.vue).

interface EditorError {
    message: string;
    /** each problem with its JSON path (RFC 6901) in the document being edited */
    issues: readonly ValidationIssue[];
}

/** `layout.load` reports paths inside its payload (`/layout/...`): the editor shows the layout. */
function documentPath(path: string): string {
    return path.replace(/^\/layout(?=\/|$)/, "") || "/";
}

function editorError(error: CommandError): EditorError {
    return {
        message: error.message,
        issues: (error.issues ?? []).map((issue) => ({
            path: documentPath(issue.path),
            message: issue.message,
        })),
    };
}

/**
 * The current `LayoutJson` (v1). It follows the model until you type; then Apply loads it into the
 * model with `layout.load` (validated first: the problems are listed with their paths and the
 * layout is left alone) and Revert drops the edit.
 */
const props = defineProps<{
    json: LayoutJson<Types>;
    /** loads the parsed document (untrusted JSON) into the model */
    onApply: (layout: unknown) => CommandResult<unknown>;
}>();
const current = computed(() => JSON.stringify(props.json, null, 2));
const draft = ref<string | null>(null);
const error = shallowRef<EditorError | null>(null);
const errorId = useId();
const edited = computed(
    () => draft.value !== null && draft.value !== current.value,
);

function apply() {
    if (draft.value === null) return;
    let parsed: unknown;
    try {
        parsed = JSON.parse(draft.value);
    } catch (caught) {
        error.value = {
            message: caught instanceof Error ? caught.message : String(caught),
            issues: [],
        };
        return;
    }
    const result = props.onApply(parsed);
    if (result.ok) {
        draft.value = null;
        error.value = null;
    } else {
        error.value = editorError(result.error);
    }
}

function revert() {
    draft.value = null;
    error.value = null;
}

function onInput(event: Event) {
    if (event.target instanceof HTMLTextAreaElement) {
        draft.value = event.target.value;
    }
}
</script>

<template>
    <section aria-label="Model JSON" :class="styles.jsonEditor">
        <div :class="styles.jsonHeader">
            <h2 :class="styles.jsonTitle">LayoutJson</h2>
            <button
                type="button"
                :disabled="!edited"
                :class="styles.revertButton"
                @click="revert"
            >
                Revert
            </button>
            <button
                type="button"
                :disabled="!edited"
                :class="styles.applyButton"
                @click="apply"
            >
                Apply
            </button>
        </div>
        <textarea
            aria-label="Layout JSON"
            :aria-invalid="error ? true : undefined"
            :aria-describedby="error ? errorId : undefined"
            :value="draft ?? current"
            spellcheck="false"
            wrap="off"
            :class="styles.jsonText"
            @input="onInput"
        />
        <div v-if="error" :id="errorId" role="alert" :class="styles.jsonError">
            <p>{{ error.message }}</p>
            <ul v-if="error.issues.length > 0" :class="styles.jsonIssues">
                <li
                    v-for="issue in error.issues"
                    :key="`${issue.path} ${issue.message}`"
                >
                    <span :class="styles.jsonIssuePath">{{ issue.path }}</span>
                    {{ issue.message }}
                </li>
            </ul>
        </div>
    </section>
</template>
