<script setup lang="ts">
// Demo content, shared by the examples: a padded, scrollable panel body with a title. Nothing
// here is part of Dockable: a panel renders whatever the consumer gives it.
import { cn } from "#/lib/cn";

const props = defineProps<{ title?: string; class?: string }>();
</script>

<template>
    <div :class="cn('flex min-h-full flex-col gap-3 p-4', props.class)">
        <h2 v-if="props.title" class="text-base">{{ props.title }}</h2>
        <slot />
    </div>
</template>
