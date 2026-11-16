<script setup lang="ts" generic="T extends DockableTypes">
import type { DockableTypes, Model } from "@fragiola/dockable-vue";
import * as styles from "./styles";
import { fromToolCall, toolName, toTools } from "./tools";

const props = defineProps<{ model: Model<T> }>();
const commands = props.model.get("commands");
const tools = toTools(commands);
// what an assistant's call turns into: the command and its payload, for model.dispatch
const example = fromToolCall(commands, {
    name: toolName("tab.select"),
    input: { tab: "todo" },
});
const call = `${toolName("tab.select")}({ "tab": "todo" })\n→ model.dispatch(${JSON.stringify(example)})`;
</script>

<template>
    <div :class="styles.toolsView">
        <p :class="styles.toolsIntro">
            Each command is a name, a description and a JSON Schema: any
            assistant that calls tools can drive the layout. Hand it these
            definitions; when it calls one, turn the call back into a command
            and pass it to <code :class="styles.code">model.dispatch</code>,
            which validates it like any other untrusted JSON. No network call or
            SDK is involved here.
        </p>
        <pre data-testid="tool-call" :class="styles.toolCall">{{ call }}</pre>
        <pre data-testid="tool-definitions" :class="styles.toolDefinitions">{{ JSON.stringify(tools, null, 2) }}</pre>
    </div>
</template>
