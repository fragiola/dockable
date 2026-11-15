<script setup lang="ts">
import { useDockable } from "@fragiola/dockable-vue";
import { onMounted, onUnmounted } from "vue";
import type { Types } from "./dockable";

// Escape restores the maximized tabset, from anywhere in the page. It renders nothing.
const { engine, model, layoutId } = useDockable<Types>();

function onKeydown(event: KeyboardEvent) {
    const maximized = model.get("maximized-tabset", { layoutId });
    if (event.key === "Escape" && !event.defaultPrevented && maximized) {
        model.run("tabset.maximize", {
            tabsetId: maximized.id,
            value: false,
        });
    }
}

let doc: Document | undefined;
onMounted(() => {
    doc = engine.get("owner-document") ?? undefined;
    doc?.addEventListener("keydown", onKeydown);
});
onUnmounted(() => doc?.removeEventListener("keydown", onKeydown));
</script>

<template></template>
