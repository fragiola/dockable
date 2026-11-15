<script setup lang="ts">
import { type Model, useModelState } from "@fragiola/dockable-vue";
import type { Types } from "./dockable";
import JsonEditor from "./JsonEditor.vue";

/** The editor follows the model: a commit re-renders it, not the layout. */
const props = defineProps<{ model: Model<Types> }>();
const json = useModelState(() => props.model.get("layout-json"), {
    model: props.model,
});

// untrusted JSON: `dispatch` validates it (JSON v1, ids) before the layout changes; a command
// like any other, so it is logged, vetoable and undoable
function apply(layout: unknown) {
    return props.model.dispatch({
        command: "layout.load",
        payload: { layout },
    });
}
</script>

<template>
    <JsonEditor :json="json" :on-apply="apply" />
</template>
