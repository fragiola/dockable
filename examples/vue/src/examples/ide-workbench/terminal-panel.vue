<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue";
import { FILE_PATHS } from "./files";
import * as styles from "./styles";
import type { Workspace } from "./workspace";

/** A small shell: enough commands to feel like one. */
const props = defineProps<{ workspace: Workspace }>();
const lines = ref<string[]>([
    "Welcome to the workbench terminal. Type `help`.",
]);
const input = ref("");
const end = useTemplateRef<HTMLDivElement>("end");

// scroll when a line is added (after the DOM shows it)
watch(
    lines,
    () => {
        end.value?.scrollIntoView({ block: "nearest" });
    },
    { flush: "post" },
);

const run = (command: string) => {
    const [name, ...args] = command.trim().split(/\s+/);
    const workspace = props.workspace;
    const out: Record<string, () => string[]> = {
        help: () => ["commands: ls, cat <file>, git status, clear"],
        ls: () => FILE_PATHS,
        cat: () => workspace.read(args[0] ?? "").split("\n"),
        git: () => {
            const modified = FILE_PATHS.filter(workspace.isDirty);
            return modified.length > 0
                ? modified.map((path) => `  modified:   ${path}`)
                : ["nothing to commit, working tree clean"];
        },
    };
    if (name === "clear") {
        lines.value = [];
        return;
    }
    const result = name
        ? (out[name]?.() ?? [`${name}: command not found`])
        : [];
    lines.value = [...lines.value, `$ ${command}`, ...result].slice(-500);
};

const onSubmit = () => {
    run(input.value);
    input.value = "";
};
</script>

<template>
    <div :class="styles.terminal">
        <!-- an append-only log: the index is the key -->
        <div v-for="(line, index) in lines" :key="index" :class="styles.terminalLine">
            {{ line }}
        </div>
        <form :class="styles.terminalForm" @submit.prevent="onSubmit">
            <span aria-hidden="true" :class="styles.terminalPrompt">
                ~/counter-app $
            </span>
            <input
                v-model="input"
                aria-label="Terminal command"
                :spellcheck="false"
                :class="styles.terminalInput"
            />
        </form>
        <div ref="end" />
    </div>
</template>
