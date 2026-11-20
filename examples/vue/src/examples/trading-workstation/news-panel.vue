<script setup lang="ts">
import type { TradingFeed } from "../_kit/trading";
import * as styles from "./styles";
import { useFeed } from "./use-feed";

/** The news wire, newest first; a headline's symbol selects its instrument. */
const props = defineProps<{ feed: TradingFeed }>();
const emit = defineEmits<{ select: [symbol: string] }>();
const snapshot = useFeed(props.feed);
</script>

<template>
    <ol aria-label="Headlines" :class="styles.news">
        <li
            v-for="headline in snapshot.news"
            :key="headline.id"
            :class="styles.headline"
        >
            <span :class="styles.tapeTime">{{ headline.time }}</span>
            <button
                type="button"
                :class="styles.headlineSymbol(headline.tone)"
                @click="emit('select', headline.symbol)"
            >
                {{ headline.symbol }}
            </button>
            <span :class="styles.headlineText">{{ headline.text }}</span>
        </li>
    </ol>
</template>
