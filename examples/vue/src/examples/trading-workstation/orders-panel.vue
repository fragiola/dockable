<script setup lang="ts">
import { computed } from "vue";
import {
    formatPrice,
    formatSize,
    instrumentOf,
    marketable,
    type TradingFeed,
} from "../_kit/trading";
import * as styles from "./styles";
import { useFeed } from "./use-feed";

/** The working orders, each marked when the live price reaches its limit. */
const props = defineProps<{ feed: TradingFeed }>();
const snapshot = useFeed(props.feed);
const rows = computed(() =>
    snapshot.value.orders.map((order) => {
        const price =
            instrumentOf(snapshot.value, order.symbol)?.price ?? order.price;
        return { order, price, ready: marketable(order, price) };
    }),
);
</script>

<template>
    <table :class="styles.table">
        <thead>
            <tr :class="styles.headRow">
                <th :class="styles.headStart">Order</th>
                <th :class="styles.headStart">Side</th>
                <th :class="styles.headStart">Symbol</th>
                <th :class="styles.head">Qty</th>
                <th :class="styles.head">Limit</th>
                <th :class="styles.head">Last</th>
                <th :class="styles.head">Status</th>
            </tr>
        </thead>
        <tbody>
            <tr
                v-for="{ order, price, ready } in rows"
                :key="order.id"
                :class="styles.row"
            >
                <td :class="styles.cellStart">{{ order.id }}</td>
                <td :class="styles.sideCell(order.side)">{{ order.side }}</td>
                <td :class="styles.cellStart">
                    <span :class="styles.symbol">{{ order.symbol }}</span>
                </td>
                <td :class="styles.cell">{{ formatSize(order.quantity) }}</td>
                <td :class="styles.cell">{{ formatPrice(order.price) }}</td>
                <td :class="styles.cell">{{ formatPrice(price) }}</td>
                <td :class="styles.statusCell(ready)">
                    {{ ready ? "At limit" : "Working" }}
                </td>
            </tr>
        </tbody>
    </table>
</template>
