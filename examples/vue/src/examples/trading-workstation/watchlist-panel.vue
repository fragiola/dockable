<script setup lang="ts">
import {
    changeOf,
    formatPercent,
    formatPrice,
    type TradingFeed,
} from "../_kit/trading";
import Sparkline from "./sparkline.vue";
import * as styles from "./styles";
import { toneOf, useFeed } from "./use-feed";

/** The instruments, live; a row makes its instrument the one the chart and the book follow. */
const props = defineProps<{ feed: TradingFeed; selected: string }>();
const emit = defineEmits<{ select: [symbol: string] }>();
const snapshot = useFeed(props.feed);
</script>

<template>
    <ul aria-label="Watchlist" :class="styles.watchlist">
        <li v-for="instrument in snapshot.instruments" :key="instrument.symbol">
            <button
                type="button"
                :aria-pressed="instrument.symbol === selected"
                :class="styles.watchRow"
                @click="emit('select', instrument.symbol)"
            >
                <span :class="styles.watchName">
                    <span :class="styles.symbol">{{ instrument.symbol }}</span>
                    <span :class="styles.instrumentName">{{
                        instrument.name
                    }}</span>
                </span>
                <Sparkline :instrument="instrument" />
                <span :class="styles.watchFigures">
                    <span :class="styles.price(instrument.direction)">{{
                        formatPrice(instrument.price)
                    }}</span>
                    <span :class="styles.change(toneOf(changeOf(instrument)))">{{
                        formatPercent(changeOf(instrument))
                    }}</span>
                </span>
            </button>
        </li>
    </ul>
</template>
