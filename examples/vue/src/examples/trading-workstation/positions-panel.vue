<script setup lang="ts">
import { computed } from "vue";
import {
    formatPrice,
    formatSigned,
    formatSize,
    instrumentOf,
    pnlOf,
    type TradingFeed,
} from "../_kit/trading";
import * as styles from "./styles";
import { toneOf, useFeed } from "./use-feed";

/** The open positions, valued at the live prices. */
const props = defineProps<{ feed: TradingFeed }>();
const snapshot = useFeed(props.feed);
const rows = computed(() =>
    snapshot.value.positions.map((position) => {
        const price =
            instrumentOf(snapshot.value, position.symbol)?.price ??
            position.cost;
        return { position, price, pnl: pnlOf(position, price) };
    }),
);
const total = computed(() => rows.value.reduce((sum, row) => sum + row.pnl, 0));
</script>

<template>
    <table :class="styles.table">
        <thead>
            <tr :class="styles.headRow">
                <th :class="styles.headStart">Symbol</th>
                <th :class="styles.head">Qty</th>
                <th :class="styles.head">Avg</th>
                <th :class="styles.head">Last</th>
                <th :class="styles.head">P&amp;L</th>
            </tr>
        </thead>
        <tbody>
            <tr
                v-for="{ position, price, pnl } in rows"
                :key="position.symbol"
                :class="styles.row"
            >
                <td :class="styles.cellStart">
                    <span :class="styles.symbol">{{ position.symbol }}</span>
                </td>
                <td :class="styles.cell">{{ formatSize(position.quantity) }}</td>
                <td :class="styles.cell">{{ formatPrice(position.cost) }}</td>
                <td :class="styles.cell">{{ formatPrice(price) }}</td>
                <td :class="styles.pnlCell(toneOf(pnl))">
                    {{ formatSigned(pnl) }}
                </td>
            </tr>
        </tbody>
        <tfoot>
            <tr :class="styles.footRow">
                <td :class="styles.cellStart" colspan="4">Open P&amp;L</td>
                <td data-testid="total-pnl" :class="styles.pnlCell(toneOf(total))">
                    {{ formatSigned(total) }}
                </td>
            </tr>
        </tfoot>
    </table>
</template>
