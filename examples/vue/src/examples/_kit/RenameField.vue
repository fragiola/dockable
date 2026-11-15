<script setup lang="ts">
// An inline text field that edits a tab's name: Enter confirms, Escape cancels, leaving the field
// confirms. An empty name is refused (the field stays open and is marked invalid; leaving it
// cancels). The caller runs `tab.rename` with the new label on `commit`.
import { onMounted, ref } from "vue";
import { cn } from "#/lib/cn";

const props = defineProps<{ name: string }>();
const emit = defineEmits<{ commit: [name: string]; cancel: [] }>();

const value = ref(props.name);
const invalid = ref(false);
const input = ref<HTMLInputElement | null>(null);
// Enter closes the field, and the unmount may still blur it: finish once
let done = false;

// focus and select on mount, so typing replaces the name
onMounted(() => {
    const element = input.value;
    if (element && element !== element.ownerDocument.activeElement) {
        element.focus();
        element.select();
    }
});

function finish(commit: boolean, element: HTMLInputElement) {
    if (done) {
        return;
    }
    const trimmed = value.value.trim();
    if (commit && trimmed === "") {
        invalid.value = true;
        return;
    }
    done = true;
    // hand focus back to the tab the field is in (unless it already went elsewhere)
    if (element.ownerDocument.activeElement === element) {
        element.closest<HTMLElement>('[role="tab"]')?.focus();
    }
    if (commit && trimmed !== props.name) {
        emit("commit", trimmed);
    } else {
        emit("cancel");
    }
}

function onKeydown(event: KeyboardEvent) {
    // the tab handles Enter, Space, arrows, Home and End itself: keep them in the field
    event.stopPropagation();
    const element = event.currentTarget as HTMLInputElement;
    if (event.key === "Enter") {
        finish(true, element);
    } else if (event.key === "Escape") {
        finish(false, element);
    }
}

function onInput(event: Event) {
    value.value = (event.currentTarget as HTMLInputElement).value;
    invalid.value = false;
}
</script>

<template>
    <input
        ref="input"
        aria-label="Tab name"
        :aria-invalid="invalid || undefined"
        :value="value"
        :size="Math.max(4, value.length)"
        :class="
            cn(
                'h-6 min-w-0 rounded-sm border border-palette-line bg-palette-base px-1 text-palette-contrast outline-none',
                'focus-visible:ring-2 focus-visible:ring-palette-ring aria-invalid:border-palette-ring aria-invalid:ring-2',
            )
        "
        @input="onInput"
        @keydown="onKeydown"
        @blur="(event) => finish(value.trim() !== '', event.currentTarget as HTMLInputElement)"
    />
</template>
