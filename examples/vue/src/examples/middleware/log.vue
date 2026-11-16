<script setup lang="ts">
import type { LogEntry } from "./dockable";
import * as styles from "./styles";

/** What the observing middleware wrote, newest first. */
defineProps<{ entries: LogEntry[] }>();
</script>

<template>
    <p v-if="entries.length === 0" :class="styles.logEmpty">
        Commands appear here.
    </p>
    <ol v-else aria-label="Command log" :class="styles.log">
        <li v-for="entry in entries" :key="entry.id" :class="styles.logEntry">
            <span :class="styles.logCommand">{{ entry.command }}</span>
            <span :class="styles.logOutcome(entry.ok)">{{ entry.outcome }}</span>
        </li>
    </ol>
</template>
