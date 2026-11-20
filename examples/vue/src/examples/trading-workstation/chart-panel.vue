<script setup lang="ts">
import { computed } from "vue";
import {
    CANDLES,
    changeOf,
    formatPercent,
    formatPrice,
    instrumentOf,
    type TradingFeed,
} from "../_kit/trading";
import * as styles from "./styles";
import { toneOf, useFeed } from "./use-feed";

/** The selected instrument's candles, drawn as SVG, with its last price marked. */
const props = defineProps<{ feed: TradingFeed; symbol: string }>();
const snapshot = useFeed(props.feed);

/** Each candle is 10 units wide in the chart's box; prices map onto a height of 100. */
const SLOT = 10;
const WIDTH = CANDLES * SLOT;

const chart = computed(() => {
    const instrument = instrumentOf(snapshot.value, props.symbol);
    if (!instrument) return undefined;
    const { candles } = instrument;
    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    const pad = (high - low) * 0.08 || 1;
    const top = high + pad;
    const range = top - (low - pad);
    const y = (price: number) => ((top - price) / range) * 100;
    return {
        instrument,
        high,
        low,
        change: changeOf(instrument),
        lastY: y(instrument.price),
        candles: candles.map((candle, i) => {
            const bodyTop = y(Math.max(candle.open, candle.close));
            const bodyBottom = y(Math.min(candle.open, candle.close));
            return {
                x: i * SLOT + SLOT / 2,
                high: y(candle.high),
                low: y(candle.low),
                top: bodyTop,
                height: Math.max(0.6, bodyBottom - bodyTop),
                tone:
                    candle.close >= candle.open
                        ? ("up" as const)
                        : ("down" as const),
            };
        }),
    };
});
</script>

<template>
    <div v-if="chart" :class="styles.chartPanel">
        <div :class="styles.chartHeader">
            <span :class="styles.chartSymbol">{{ chart.instrument.symbol }}</span>
            <span :class="styles.instrumentName">{{ chart.instrument.name }}</span>
            <span
                data-testid="last-price"
                :class="styles.chartPrice(chart.instrument.direction)"
                >{{ formatPrice(chart.instrument.price) }}</span
            >
            <span :class="styles.change(toneOf(chart.change))">{{
                formatPercent(chart.change)
            }}</span>
            <span :class="styles.chartRange">{{
                `H ${formatPrice(chart.high)} · L ${formatPrice(chart.low)}`
            }}</span>
        </div>
        <div :class="styles.plot">
            <svg
                role="img"
                :aria-label="`${chart.instrument.symbol} price, the last ${CANDLES} candles`"
                :viewBox="`0 0 ${WIDTH} 100`"
                preserveAspectRatio="none"
                :class="styles.plotSvg"
            >
                <line
                    v-for="line in [25, 50, 75]"
                    :key="line"
                    :x1="0"
                    :x2="WIDTH"
                    :y1="line"
                    :y2="line"
                    :class="styles.gridLine"
                />
                <!-- a candle is its slot -->
                <g
                    v-for="(candle, i) in chart.candles"
                    :key="i"
                    :class="styles.candle(candle.tone)"
                >
                    <line
                        :x1="candle.x"
                        :x2="candle.x"
                        :y1="candle.high"
                        :y2="candle.low"
                        :class="styles.wick"
                    />
                    <rect
                        :x="candle.x - SLOT * 0.3"
                        :width="SLOT * 0.6"
                        :y="candle.top"
                        :height="candle.height"
                    />
                </g>
                <line
                    :x1="0"
                    :x2="WIDTH"
                    :y1="chart.lastY"
                    :y2="chart.lastY"
                    :class="styles.lastLine(chart.instrument.direction)"
                />
            </svg>
            <!-- the label is HTML, so the stretched SVG does not stretch its text -->
            <span
                aria-hidden="true"
                :style="{ top: `${chart.lastY}%` }"
                :class="styles.lastLabel(chart.instrument.direction)"
                >{{ formatPrice(chart.instrument.price) }}</span
            >
        </div>
    </div>
</template>
