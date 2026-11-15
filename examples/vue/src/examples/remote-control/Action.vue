<script setup lang="ts">
import type { CommandResult } from "@fragiola/dockable-vue";
import * as styles from "./styles";

/**
 * A command button: disabled when its dry run (`model.check`) is refused, with the reason as its
 * tooltip. `model.can` answers the same question with a boolean; `check` also says why.
 */
defineProps<{ dryRun: CommandResult<unknown> }>();
defineEmits<{ click: [] }>();
</script>

<template>
    <button
        type="button"
        :disabled="!dryRun.ok"
        :title="dryRun.ok ? undefined : dryRun.error.message"
        :class="styles.action"
        @click="$emit('click')"
    >
        <slot />
    </button>
</template>
