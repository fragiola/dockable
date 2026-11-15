<script setup lang="ts">
import { CircleAlert, TriangleAlert } from "@lucide/vue";
import { PROBLEMS } from "./files";
import * as styles from "./styles";

/** The linter's findings; clicking one opens its file. */
const emit = defineEmits<{ open: [path: string] }>();
</script>

<template>
    <ul :class="styles.problems">
        <li
            v-for="problem in PROBLEMS"
            :key="`${problem.path}:${problem.line}`"
        >
            <button
                type="button"
                :class="styles.problem"
                @click="emit('open', problem.path)"
            >
                <component
                    :is="problem.severity === 'error' ? CircleAlert : TriangleAlert"
                    :aria-label="problem.severity"
                    :class="styles.problemIcon(problem.severity)"
                />
                <span :class="styles.problemMessage">
                    {{ problem.message }}
                </span>
                <span :class="styles.problemLocation">
                    {{ `${problem.path}:${problem.line}` }}
                </span>
            </button>
        </li>
    </ul>
</template>
