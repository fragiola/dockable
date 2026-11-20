<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import type { TradingFeed } from "../_kit/trading";
import ChartPanel from "./chart-panel.vue";
import type { Types } from "./dockable";
import NewsPanel from "./news-panel.vue";
import OrderBookPanel from "./order-book-panel.vue";
import OrdersPanel from "./orders-panel.vue";
import PositionsPanel from "./positions-panel.vue";
import TradesPanel from "./trades-panel.vue";
import WatchlistPanel from "./watchlist-panel.vue";

// The content of each tab: `tab.data` narrows on `tab.component` (the chart's instrument).
defineProps<{ tab: TabOf<Types>; feed: TradingFeed; symbol: string }>();
const emit = defineEmits<{ select: [symbol: string] }>();
</script>

<template>
    <WatchlistPanel
        v-if="tab.component === 'watchlist'"
        :feed="feed"
        :selected="symbol"
        @select="emit('select', $event)"
    />
    <NewsPanel
        v-else-if="tab.component === 'news'"
        :feed="feed"
        @select="emit('select', $event)"
    />
    <ChartPanel
        v-else-if="tab.component === 'chart'"
        :feed="feed"
        :symbol="tab.data.symbol"
    />
    <OrderBookPanel
        v-else-if="tab.component === 'book'"
        :feed="feed"
        :symbol="symbol"
    />
    <TradesPanel
        v-else-if="tab.component === 'trades'"
        :feed="feed"
        :symbol="symbol"
    />
    <PositionsPanel v-else-if="tab.component === 'positions'" :feed="feed" />
    <OrdersPanel v-else :feed="feed" />
</template>
