<script setup lang="ts">
import { computed } from "vue";
import { formatSigned, type TradingFeed, totalPnlOf } from "../_kit/trading";
import * as styles from "./styles";
import { useFeed } from "./use-feed";

/** The account line: the market clock and the open P&L, updated by the feed alone. */
const props = defineProps<{ feed: TradingFeed }>();
const snapshot = useFeed(props.feed);
const pnl = computed(() => totalPnlOf(snapshot.value));
const tone = computed(() => (pnl.value >= 0 ? "up" : "down"));
</script>

<template>
    <span :class="styles.account">
        <time data-testid="feed-clock" :class="styles.clock">{{
            snapshot.time
        }}</time>
        <span :class="styles.accountTerm">Open P&amp;L</span>
        <span :class="styles.accountPnl(tone)">{{ formatSigned(pnl) }}</span>
    </span>
</template>
