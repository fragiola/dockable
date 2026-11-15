<script setup lang="ts" generic="T extends DockableTypes">
import type {
    CommandResult,
    DockableTypes,
    Model,
} from "@fragiola/dockable-vue";
import { ref, shallowRef, useId } from "vue";
import { type LogEntry, SAMPLES } from "./console";
import ErrorBox from "./ErrorBox.vue";
import * as styles from "./styles";

const props = defineProps<{
    model: Model<T>;
    /** every commit, from the console or from the layout itself */
    log: readonly LogEntry[];
}>();
const input = ref(JSON.stringify(SAMPLES[0].input, null, 2));
const result = shallowRef<CommandResult<unknown> | null>(null);
const parseError = ref<string | null>(null);
const inputId = useId();

function run() {
    let parsed: unknown;
    try {
        parsed = JSON.parse(input.value);
    } catch (caught) {
        parseError.value =
            caught instanceof Error ? caught.message : String(caught);
        result.value = null;
        return;
    }
    parseError.value = null;
    // untrusted JSON: dispatch validates the command name and the payload, and never throws
    result.value = props.model.dispatch(parsed);
}
</script>

<template>
    <div :class="styles.consoleView">
        <div :class="styles.samples">
            <button
                v-for="sample in SAMPLES"
                :key="sample.label"
                type="button"
                :class="styles.sampleButton"
                @click="input = JSON.stringify(sample.input, null, 2)"
            >
                {{ sample.label }}
            </button>
        </div>
        <label :for="inputId" :class="styles.inputLabel">Command (JSON)</label>
        <textarea
            :id="inputId"
            v-model="input"
            data-testid="command-input"
            spellcheck="false"
            rows="6"
            :class="styles.input"
        />
        <button type="button" :class="styles.runButton" @click="run">
            Run
        </button>
        <output data-testid="result" aria-live="polite" :class="styles.result">
            <ErrorBox
                v-if="parseError"
                code="parse"
                :message="parseError"
                :path="undefined"
                :issues="[]"
            />
            <template v-else-if="result === null" />
            <div v-else-if="result.ok" :class="styles.success">
                <p :class="styles.successTitle">ok</p>
                <pre :class="styles.successValue">{{ JSON.stringify(result.value, null, 2) }}</pre>
            </div>
            <ErrorBox
                v-else
                :code="result.error.code"
                :message="result.error.message"
                :path="result.error.path"
                :issues="result.error.issues ?? []"
            />
        </output>
        <div>
            <h3 :class="styles.logTitle">Log (model.subscribe)</h3>
            <ol data-testid="log" :class="styles.log">
                <li v-for="entry in log" :key="entry.id" :class="styles.logEntry">
                    <span :class="styles.logCommand">{{ entry.command }}</span>
                    {{ entry.transient ? "(transient) " : "" }}{{ entry.payload }}
                </li>
            </ol>
        </div>
    </div>
</template>
