<script setup lang="ts">
import { type Model, veto as vetoResult } from "@fragiola/dockable-vue";
import { onUnmounted, shallowRef } from "vue";
import CommandLog from "./command-log.vue";
import { appendToLog, type LogEntry, type Veto } from "./commands";
import type { Types } from "./dockable";

/**
 * Every command passes here first: it is logged, and applied unless it is the vetoed one. The
 * middleware is installed once and reads the current veto from the props; the log is this
 * component's state, so a command re-renders the log, not the layout.
 */
const props = defineProps<{ model: Model<Types>; veto: Veto }>();
const log = shallowRef<LogEntry[]>([]);
const remove = props.model.use((ctx, next) => {
    const current = props.veto;
    const vetoed = current.enabled && ctx.command === current.command;
    const result = vetoed
        ? vetoResult(`${ctx.command} is vetoed in the lab`)
        : next();
    // a dry run (`model.can`: a drag hovering a target, a button's enabled state)
    // commits nothing, and a batch is logged once, as the batch
    if (!ctx.dryRun && !ctx.inBatch) {
        log.value = appendToLog(
            log.value,
            ctx.command,
            ctx.payload,
            result.ok ? "applied" : result.error.code,
            ctx.transient,
        );
    }
    return result;
});
onUnmounted(remove);
</script>

<template>
    <CommandLog :log="log" @clear="log = []" />
</template>
