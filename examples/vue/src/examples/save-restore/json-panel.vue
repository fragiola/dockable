<script setup lang="ts">
import { useModelState } from "@fragiola/dockable-vue";
import PanelBody from "../_kit/panel-body.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

/** The model's JSON, live: this is everything there is to save. */
const text = useModelState<Types, string>((_state, model) =>
    JSON.stringify(model.get("layout-json"), null, 2),
);
</script>

<template>
    <PanelBody title='model.get("layout-json")'>
        <pre data-testid="layout-json" :class="styles.layoutJson">{{ text }}</pre>
    </PanelBody>
</template>
