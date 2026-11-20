<script setup lang="ts">
import { computed } from "vue";
import { changeOf, type Instrument } from "../_kit/trading";
import * as styles from "./styles";
import { toneOf } from "./use-feed";

/** A line of the last closes, drawn in a 100 × 24 box stretched to the element. */
const props = defineProps<{ instrument: Instrument }>();
const points = computed(() => {
    const closes = props.instrument.candles.map((candle) => candle.close);
    const low = Math.min(...closes);
    const range = Math.max(...closes) - low || 1;
    return closes
        .map(
            (close, i) =>
                `${(i / Math.max(1, closes.length - 1)) * 100},${22 - ((close - low) / range) * 20}`,
        )
        .join(" ");
});
</script>

<template>
    <svg
        aria-hidden="true"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        :class="styles.sparkline(toneOf(changeOf(instrument)))"
    >
        <polyline :points="points" :class="styles.sparklineLine" />
    </svg>
</template>
