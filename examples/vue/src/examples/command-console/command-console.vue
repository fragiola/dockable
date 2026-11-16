<script setup lang="ts" generic="T extends DockableTypes = AnyTypes">
import type { AnyTypes, DockableTypes, Model } from "@fragiola/dockable-vue";
import { ref } from "vue";
import CommandList from "./command-list.vue";
import { useCommandLog } from "./console";
import ConsoleView from "./console-view.vue";
import * as styles from "./styles";
import ToolsView from "./tools-view.vue";

// The console lives outside the layout and talks to the model only: `commands()` to list what it
// can do, `dispatch` to run a command given as JSON (validated like any untrusted input), and
// `subscribe` to log every change, whoever made it (the console, a drag, a click).

type View = "console" | "commands" | "tools";

const props = defineProps<{ model: Model<T> }>();
const view = ref<View>("console");
// the log lives here, so it keeps every change while the other views are shown
const log = useCommandLog(props.model);

const VIEWS = [
    ["console", "Console"],
    ["commands", "Commands"],
    ["tools", "As AI tools"],
] as const;
</script>

<template>
    <section aria-label="Command console" :class="styles.commandConsole">
        <div :class="styles.viewBar">
            <button
                v-for="[value, label] in VIEWS"
                :key="value"
                type="button"
                :aria-pressed="view === value"
                :class="styles.viewButton"
                @click="view = value"
            >
                {{ label }}
            </button>
        </div>
        <div :class="styles.viewBody">
            <ConsoleView v-if="view === 'console'" :model="model" :log="log" />
            <CommandList v-else-if="view === 'commands'" :model="model" />
            <ToolsView v-else :model="model" />
        </div>
    </section>
</template>
