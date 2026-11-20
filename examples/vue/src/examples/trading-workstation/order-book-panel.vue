<script setup lang="ts">
import { computed } from "vue";
import {
    bookOf,
    formatPrice,
    instrumentOf,
    type TradingFeed,
} from "../_kit/trading";
import BookSide from "./book-side.vue";
import * as styles from "./styles";
import { useFeed } from "./use-feed";

/** The book of the selected instrument: asks above the spread, bids below. */
const props = defineProps<{ feed: TradingFeed; symbol: string }>();
const snapshot = useFeed(props.feed);
const book = computed(() => {
    const instrument = instrumentOf(snapshot.value, props.symbol);
    if (!instrument) return undefined;
    const { bids, asks, spread } = bookOf(instrument, snapshot.value.tick, 8);
    return { instrument, bids, asks: [...asks].reverse(), spread };
});
</script>

<template>
    <div v-if="book" :class="styles.bookPanel">
        <div :class="styles.bookHeader">
            <span data-testid="book-symbol" :class="styles.symbol">{{
                book.instrument.symbol
            }}</span>
            <span :class="styles.bookColumns">Price · Size · Total</span>
        </div>
        <BookSide :levels="book.asks" side="ask" />
        <div :class="styles.spread">
            <span :class="styles.price(book.instrument.direction)">{{
                formatPrice(book.instrument.price)
            }}</span>
            <span data-testid="book-spread" :class="styles.spreadValue">{{
                `spread ${formatPrice(book.spread)}`
            }}</span>
        </div>
        <BookSide :levels="book.bids" side="bid" />
    </div>
</template>
