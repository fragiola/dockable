<script setup lang="ts">
// Content with state you can see: a counter and a text input. Move the tab to another tabset,
// maximize it or pop it out, and both keep their value: the content is never remounted.
import { ref } from "vue";
import PanelBody from "./PanelBody.vue";

defineProps<{ name: string }>();
const count = ref(0);
</script>

<template>
    <PanelBody :title="name">
        <p class="text-palette-accent/85">
            Drag the tab, resize with the splitters. The counter and the notes
            survive every move.
        </p>
        <div class="flex flex-wrap items-center gap-2">
            <button
                type="button"
                data-testid="counter"
                class="palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2"
                @click="count++"
            >
                Count: {{ count }}
            </button>
            <input
                data-testid="notes"
                :aria-label="`${name} notes`"
                placeholder="Notes"
                class="h-8 min-w-0 rounded-md border border-palette-line bg-palette-soft px-3 text-sm placeholder:text-palette-accent/85 focus-visible:outline-2 focus-visible:outline-palette-ring"
            />
        </div>
        <slot />
    </PanelBody>
</template>
