<script setup lang="ts">
import { formatPrice, formatSize, type TradingFeed } from "../_kit/trading";
import * as styles from "./styles";
import { useFeed } from "./use-feed";

/** The selected instrument's prints, newest first. */
const props = defineProps<{ feed: TradingFeed; symbol: string }>();
const snapshot = useFeed(props.feed);
</script>

<template>
    <ol :aria-label="`${symbol} trades`" :class="styles.tape">
        <li
            v-for="trade in snapshot.trades[symbol] ?? []"
            :key="trade.id"
            :class="styles.tapeRow"
        >
            <span :class="styles.tapeTime">{{ trade.time }}</span>
            <span :class="styles.tradePrice(trade.side)">{{
                formatPrice(trade.price)
            }}</span>
            <span :class="styles.bookSize">{{ formatSize(trade.size) }}</span>
        </li>
    </ol>
</template>
