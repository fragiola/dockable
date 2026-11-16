<script setup lang="ts">
import PanelBody from "../_kit/panel-body.vue";
import { keys } from "./dockable";
import Keys from "./keys.vue";
import * as styles from "./styles";

// A panel listing every key, fixed and configured.
const LEGEND: { keys: string[]; does: string }[] = [
    { keys: ["Tab"], does: "Between the tab strips and the splitters" },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "Previous or next tab in the strip",
    },
    { keys: ["Home", "End"], does: "First or last tab" },
    {
        keys: ["Enter", "Space"],
        does: "Select the focused tab; on the selected one, enter its content",
    },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "On a focused splitter: resize",
    },
];
</script>

<template>
    <PanelBody title="Keyboard">
        <dl :class="styles.legend">
            <div v-for="row in LEGEND" :key="row.does" :class="styles.legendRow">
                <dt :class="styles.legendKeys">
                    <Keys v-for="key in row.keys" :key="key" :spec="key" />
                </dt>
                <dd :class="styles.legendAction">{{ row.does }}</dd>
            </div>
            <dt>
                <Keys :spec="keys.focusNextTabset" />
            </dt>
            <dd :class="styles.legendAction">
                Next tabset, from anywhere in the layout
            </dd>
            <dt>
                <Keys :spec="keys.focusPreviousTabset" />
            </dt>
            <dd :class="styles.legendAction">Previous tabset</dd>
            <dt>
                <Keys :spec="keys.focusTabToggle" />
            </dt>
            <dd :class="styles.legendAction">Between a tab and its content</dd>
            <dt>
                <Keys :spec="keys.closeTab" />
            </dt>
            <dd :class="styles.legendAction">Close the focused tab</dd>
        </dl>
    </PanelBody>
</template>
