<script setup lang="ts">
import { computed } from "vue";
import { type BookLevel, formatPrice, formatSize } from "../_kit/trading";
import * as styles from "./styles";

/** One side of the book, a bar per level as wide as its share of the side's total. */
const props = defineProps<{
    levels: readonly BookLevel[];
    side: "bid" | "ask";
}>();
const total = computed(() =>
    Math.max(1, ...props.levels.map((level) => level.total)),
);
</script>

<template>
    <ol
        :aria-label="side === 'bid' ? 'Bids' : 'Asks'"
        :class="styles.bookSide(side)"
    >
        <li
            v-for="(level, index) in levels"
            :key="level.price"
            :data-testid="index === 0 ? `best-${side}` : undefined"
            :class="styles.bookLevel"
        >
            <span
                aria-hidden="true"
                :style="{ width: `${(level.total / total) * 100}%` }"
                :class="styles.depthBar(side)"
            />
            <span :class="styles.bookPrice(side)">{{
                formatPrice(level.price)
            }}</span>
            <span :class="styles.bookSize">{{ formatSize(level.size) }}</span>
            <span :class="styles.bookTotal">{{ formatSize(level.total) }}</span>
        </li>
    </ol>
</template>
