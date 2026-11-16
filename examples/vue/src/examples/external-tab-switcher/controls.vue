<script setup lang="ts">
import { type Model, useModelState } from "@fragiola/dockable-vue";
import { Minus, Plus, RotateCcw } from "@lucide/vue";
import { setCount } from "./counter";
import type { Types } from "./dockable";
import * as styles from "./styles";

// The controls outside the layout: a component of their own, with refs that follow the model, so
// a commit re-renders them, not the layout.
const props = defineProps<{ model: Model<Types> }>();

const tabs = useModelState(() => props.model.get("tabs"), {
    model: props.model,
});
// the tab the user is looking at: the selected tab of the active tabset (else the first)
const current = useModelState(
    () => {
        const tabset = props.model.get("default-tabset");
        return tabset
            ? props.model.get("selected-tab-by", { tabsetId: tabset.id })
            : undefined;
    },
    { model: props.model },
);

function step(by: number) {
    if (current.value) {
        setCount(props.model, current.value, current.value.data.count + by);
    }
}

function reset() {
    if (current.value) setCount(props.model, current.value, 0);
}
</script>

<template>
    <div :class="styles.controls">
        <fieldset aria-label="Show tab" :class="styles.switcher">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                type="button"
                :aria-pressed="tab.id === current?.id"
                :class="styles.switchButton"
                @click="model.run('tab.select', { tabId: tab.id })"
            >
                {{ tab.label }}
                <span :class="styles.switchCount">{{ tab.data.count }}</span>
            </button>
        </fieldset>
        <fieldset aria-label="Selected counter" :class="styles.stepper">
            <button
                type="button"
                aria-label="Decrement"
                :disabled="!current"
                :class="styles.stepButton"
                @click="step(-1)"
            >
                <Minus aria-hidden="true" :class="styles.icon" />
            </button>
            <output data-testid="outside-count" :class="styles.stepValue">
                {{
                    current
                        ? `${current.label}: ${current.data.count}`
                        : "No tab"
                }}
            </output>
            <button
                type="button"
                aria-label="Increment"
                :disabled="!current"
                :class="styles.stepButton"
                @click="step(1)"
            >
                <Plus aria-hidden="true" :class="styles.icon" />
            </button>
            <button
                type="button"
                aria-label="Reset"
                :disabled="!current"
                :class="styles.stepButton"
                @click="reset"
            >
                <RotateCcw aria-hidden="true" :class="styles.icon" />
            </button>
        </fieldset>
    </div>
</template>
