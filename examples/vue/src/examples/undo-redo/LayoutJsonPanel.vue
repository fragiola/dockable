<script setup lang="ts">
import { useModelState } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/PanelBody.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

/** The layout's JSON, live: undo brings back exactly the previous text. */
const text = useModelState<Types, string>((_state, model) =>
    JSON.stringify(model.get("layout-json"), null, 2),
);
</script>

<template>
    <PanelBody title="Layout JSON">
        <pre data-testid="layout-json" :class="styles.layoutJson">{{ text }}</pre>
    </PanelBody>
</template>
