<script setup lang="ts">
import type { LogEntry } from "./commands";
import * as styles from "./styles";

/** Every command, newest first: its name, its payload, and whether it applied (or why not). */
defineProps<{ log: LogEntry[] }>();
defineEmits<{ clear: [] }>();
</script>

<template>
    <section aria-label="Command log" :class="styles.log">
        <div :class="styles.logHeader">
            <h2 :class="styles.logTitle">
                model.use<span :class="styles.logCount">{{ `${log.length} commands` }}</span>
            </h2>
            <button
                type="button"
                :disabled="log.length === 0"
                :class="styles.clearButton"
                @click="$emit('clear')"
            >
                Clear
            </button>
        </div>
        <ol data-testid="action-log" :class="styles.logList">
            <li v-if="log.length === 0" :class="styles.logEmpty">
                Drag, click or resize: every change is a command.
            </li>
            <li
                v-for="entry in [...log].reverse()"
                :key="entry.id"
                :data-vetoed="entry.outcome === 'vetoed' ? '' : undefined"
                :class="styles.logEntry"
            >
                <span :class="styles.logOutcome(entry.outcome)">{{ entry.outcome }}</span>
                <span :class="styles.logCommand">{{ entry.command }}</span>
                <span :class="styles.logPayload">{{ entry.payload }}</span>
            </li>
        </ol>
    </section>
</template>
