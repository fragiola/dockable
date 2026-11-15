<script setup lang="ts">
import { useDockable } from "@fragiola/dockable-vue";
import { setCount } from "./counter";
import type { CounterTab, Types } from "./dockable";
import * as styles from "./styles";

// A tab's content: its count, read from the tab's data, with its own button to add one.
defineProps<{ tab: CounterTab }>();
const { model } = useDockable<Types>();
</script>

<template>
    <div :class="styles.counter">
        <h2 :class="styles.counterName">{{ tab.label }}</h2>
        <p data-testid="count" :class="styles.counterValue">
            {{ tab.data.count }}
        </p>
        <button
            type="button"
            :class="styles.counterButton"
            @click="setCount(model, tab, tab.data.count + 1)"
        >
            Add one
        </button>
    </div>
</template>
