<script setup lang="ts">
import { type Model, useModelState } from "@fragiola/dockable-vue";
import { GitBranch } from "@lucide/vue";
import type { Types } from "./dockable";
import * as styles from "./styles";
import { activePath, dirtyPaths } from "./workspace";

/** The status bar follows the model: a commit updates it, not the layout. */
const props = defineProps<{ model: Model<Types> }>();
const unsaved = useModelState(() => dirtyPaths(props.model).size, {
    model: props.model,
});
const path = useModelState(() => activePath(props.model), {
    model: props.model,
});
</script>

<template>
    <footer :class="styles.statusBar">
        <span :class="styles.statusBranch">
            <GitBranch aria-hidden="true" :class="styles.statusBranchIcon" />
            main
        </span>
        <span data-testid="unsaved-count">
            {{ unsaved === 1 ? "1 unsaved file" : `${unsaved} unsaved files` }}
        </span>
        <span :class="styles.statusPath">{{ path ?? "" }}</span>
    </footer>
</template>
