<script setup lang="ts">
import { type TabOf, useModelState } from "@fragiola/dockable-vue";
import { onMounted, useTemplateRef, watch } from "vue";
import type { Types } from "./dockable";
import Tab from "./Tab.vue";

// A tab of a scrolling strip: scrolls itself into view when it becomes the selected one.
const props = defineProps<{ tab: TabOf<Types> }>();
const tabRef = useTemplateRef("tabRef");
const selected = useModelState<Types, boolean>((_, model) =>
    model.is("tab-selected", { tabId: props.tab.id }),
);

function reveal() {
    // a component's template ref is its instance; the tab's element is its `$el`
    const element: Element | undefined = tabRef.value?.$el;
    if (selected.value && element?.nodeType === Node.ELEMENT_NODE) {
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}

onMounted(reveal);
watch(selected, reveal, { flush: "post" });
</script>

<template>
    <Tab ref="tabRef" :tab="tab" />
</template>
