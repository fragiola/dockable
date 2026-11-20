"use client";

import { useSyncExternalStore } from "react";
import {
    bookOf,
    CANDLES,
    changeOf,
    formatPercent,
    formatPrice,
    formatSigned,
    formatSize,
    type Instrument,
    instrumentOf,
    marketable,
    pnlOf,
    type TradingFeed,
} from "../_kit/trading";
import * as styles from "./styles";

// The content of each tab. Every panel subscribes to the feed and unsubscribes when it unmounts
// (useSyncExternalStore does both), so a panel keeps ticking wherever its tab is moved: another
// tabset, a border, a maximized tabset or a popout window. The charts are plain SVG.

function useFeed(feed: TradingFeed) {
    return useSyncExternalStore(
        feed.subscribe,
        feed.getSnapshot,
        feed.getSnapshot,
    );
}

/** Up, down or flat, as the tone the styles colour. */
const toneOf = (value: number) =>
    value > 0 ? "up" : value < 0 ? "down" : "flat";

/** A line of the last closes, drawn in a 100 × 24 box stretched to the element. */
function Sparkline({ instrument }: { instrument: Instrument }) {
    const closes = instrument.candles.map((candle) => candle.close);
    const low = Math.min(...closes);
    const range = Math.max(...closes) - low || 1;
    const points = closes
        .map(
            (close, i) =>
                `${(i / Math.max(1, closes.length - 1)) * 100},${22 - ((close - low) / range) * 20}`,
        )
        .join(" ");
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className={styles.sparkline(toneOf(changeOf(instrument)))}
        >
            <polyline points={points} className={styles.sparklineLine} />
        </svg>
    );
}

/** The instruments, live; a row makes its instrument the one the chart and the book follow. */
export function WatchlistPanel({
    feed,
    selected,
    onSelect,
}: {
    feed: TradingFeed;
    selected: string;
    onSelect: (symbol: string) => void;
}) {
    const { instruments } = useFeed(feed);
    return (
        <ul aria-label="Watchlist" className={styles.watchlist}>
            {instruments.map((instrument) => {
                const change = changeOf(instrument);
                return (
                    <li key={instrument.symbol}>
                        <button
                            type="button"
                            aria-pressed={instrument.symbol === selected}
                            onClick={() => onSelect(instrument.symbol)}
                            className={styles.watchRow}
                        >
                            <span className={styles.watchName}>
                                <span className={styles.symbol}>
                                    {instrument.symbol}
                                </span>
                                <span className={styles.instrumentName}>
                                    {instrument.name}
                                </span>
                            </span>
                            <Sparkline instrument={instrument} />
                            <span className={styles.watchFigures}>
                                <span
                                    className={styles.price(
                                        instrument.direction,
                                    )}
                                >
                                    {formatPrice(instrument.price)}
                                </span>
                                <span className={styles.change(toneOf(change))}>
                                    {formatPercent(change)}
                                </span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

/** Each candle is 10 units wide in the chart's box; prices map onto a height of 100. */
const SLOT = 10;

/** The selected instrument's candles, drawn as SVG, with its last price marked. */
export function ChartPanel({
    feed,
    symbol,
}: {
    feed: TradingFeed;
    symbol: string;
}) {
    const snapshot = useFeed(feed);
    const instrument = instrumentOf(snapshot, symbol);
    if (!instrument) return null;
    const { candles } = instrument;
    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    const pad = (high - low) * 0.08 || 1;
    const top = high + pad;
    const range = top - (low - pad);
    const y = (price: number) => ((top - price) / range) * 100;
    const change = changeOf(instrument);
    const lastY = y(instrument.price);
    return (
        <div className={styles.chartPanel}>
            <div className={styles.chartHeader}>
                <span className={styles.chartSymbol}>{instrument.symbol}</span>
                <span className={styles.instrumentName}>{instrument.name}</span>
                <span
                    data-testid="last-price"
                    className={styles.chartPrice(instrument.direction)}
                >
                    {formatPrice(instrument.price)}
                </span>
                <span className={styles.change(toneOf(change))}>
                    {formatPercent(change)}
                </span>
                <span className={styles.chartRange}>
                    {`H ${formatPrice(high)} · L ${formatPrice(low)}`}
                </span>
            </div>
            <div className={styles.plot}>
                <svg
                    role="img"
                    aria-label={`${instrument.symbol} price, the last ${CANDLES} candles`}
                    viewBox={`0 0 ${CANDLES * SLOT} 100`}
                    preserveAspectRatio="none"
                    className={styles.plotSvg}
                >
                    {[25, 50, 75].map((line) => (
                        <line
                            key={line}
                            x1={0}
                            x2={CANDLES * SLOT}
                            y1={line}
                            y2={line}
                            className={styles.gridLine}
                        />
                    ))}
                    {candles.map((candle, i) => {
                        const x = i * SLOT + SLOT / 2;
                        const bodyTop = y(Math.max(candle.open, candle.close));
                        const bodyBottom = y(
                            Math.min(candle.open, candle.close),
                        );
                        const tone =
                            candle.close >= candle.open ? "up" : "down";
                        return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a candle is its slot
                            <g key={i} className={styles.candle(tone)}>
                                <line
                                    x1={x}
                                    x2={x}
                                    y1={y(candle.high)}
                                    y2={y(candle.low)}
                                    className={styles.wick}
                                />
                                <rect
                                    x={x - SLOT * 0.3}
                                    width={SLOT * 0.6}
                                    y={bodyTop}
                                    height={Math.max(0.6, bodyBottom - bodyTop)}
                                />
                            </g>
                        );
                    })}
                    <line
                        x1={0}
                        x2={CANDLES * SLOT}
                        y1={lastY}
                        y2={lastY}
                        className={styles.lastLine(instrument.direction)}
                    />
                </svg>
                {/* the label is HTML, so the stretched SVG does not stretch its text */}
                <span
                    aria-hidden="true"
                    style={{ top: `${lastY}%` }}
                    className={styles.lastLabel(instrument.direction)}
                >
                    {formatPrice(instrument.price)}
                </span>
            </div>
        </div>
    );
}

/** One side of the book, a bar per level as wide as its share of the side's total. */
function BookSide({
    levels,
    side,
}: {
    levels: ReturnType<typeof bookOf>["bids"];
    side: "bid" | "ask";
}) {
    const total = Math.max(1, ...levels.map((level) => level.total));
    return (
        <ol
            aria-label={side === "bid" ? "Bids" : "Asks"}
            className={styles.bookSide(side)}
        >
            {levels.map((level, index) => (
                <li
                    key={level.price}
                    data-testid={index === 0 ? `best-${side}` : undefined}
                    className={styles.bookLevel}
                >
                    <span
                        aria-hidden="true"
                        style={{ width: `${(level.total / total) * 100}%` }}
                        className={styles.depthBar(side)}
                    />
                    <span className={styles.bookPrice(side)}>
                        {formatPrice(level.price)}
                    </span>
                    <span className={styles.bookSize}>
                        {formatSize(level.size)}
                    </span>
                    <span className={styles.bookTotal}>
                        {formatSize(level.total)}
                    </span>
                </li>
            ))}
        </ol>
    );
}

/** The book of the selected instrument: asks above the spread, bids below. */
export function OrderBookPanel({
    feed,
    symbol,
}: {
    feed: TradingFeed;
    symbol: string;
}) {
    const snapshot = useFeed(feed);
    const instrument = instrumentOf(snapshot, symbol);
    if (!instrument) return null;
    const { bids, asks, spread } = bookOf(instrument, snapshot.tick, 8);
    return (
        <div className={styles.bookPanel}>
            <div className={styles.bookHeader}>
                <span data-testid="book-symbol" className={styles.symbol}>
                    {instrument.symbol}
                </span>
                <span className={styles.bookColumns}>Price · Size · Total</span>
            </div>
            <BookSide levels={[...asks].reverse()} side="ask" />
            <div className={styles.spread}>
                <span className={styles.price(instrument.direction)}>
                    {formatPrice(instrument.price)}
                </span>
                <span data-testid="book-spread" className={styles.spreadValue}>
                    {`spread ${formatPrice(spread)}`}
                </span>
            </div>
            <BookSide levels={bids} side="bid" />
        </div>
    );
}

/** The selected instrument's prints, newest first. */
export function TradesPanel({
    feed,
    symbol,
}: {
    feed: TradingFeed;
    symbol: string;
}) {
    const { trades } = useFeed(feed);
    return (
        <ol aria-label={`${symbol} trades`} className={styles.tape}>
            {(trades[symbol] ?? []).map((trade) => (
                <li key={trade.id} className={styles.tapeRow}>
                    <span className={styles.tapeTime}>{trade.time}</span>
                    <span className={styles.tradePrice(trade.side)}>
                        {formatPrice(trade.price)}
                    </span>
                    <span className={styles.bookSize}>
                        {formatSize(trade.size)}
                    </span>
                </li>
            ))}
        </ol>
    );
}

/** The open positions, valued at the live prices. */
export function PositionsPanel({ feed }: { feed: TradingFeed }) {
    const snapshot = useFeed(feed);
    let total = 0;
    const rows = snapshot.positions.map((position) => {
        const price =
            instrumentOf(snapshot, position.symbol)?.price ?? position.cost;
        const pnl = pnlOf(position, price);
        total += pnl;
        return { position, price, pnl };
    });
    return (
        <table className={styles.table}>
            <thead>
                <tr className={styles.headRow}>
                    <th className={styles.headStart}>Symbol</th>
                    <th className={styles.head}>Qty</th>
                    <th className={styles.head}>Avg</th>
                    <th className={styles.head}>Last</th>
                    <th className={styles.head}>P&amp;L</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(({ position, price, pnl }) => (
                    <tr key={position.symbol} className={styles.row}>
                        <td className={styles.cellStart}>
                            <span className={styles.symbol}>
                                {position.symbol}
                            </span>
                        </td>
                        <td className={styles.cell}>
                            {formatSize(position.quantity)}
                        </td>
                        <td className={styles.cell}>
                            {formatPrice(position.cost)}
                        </td>
                        <td className={styles.cell}>{formatPrice(price)}</td>
                        <td className={styles.pnlCell(toneOf(pnl))}>
                            {formatSigned(pnl)}
                        </td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr className={styles.footRow}>
                    <td className={styles.cellStart} colSpan={4}>
                        Open P&amp;L
                    </td>
                    <td
                        data-testid="total-pnl"
                        className={styles.pnlCell(toneOf(total))}
                    >
                        {formatSigned(total)}
                    </td>
                </tr>
            </tfoot>
        </table>
    );
}

/** The working orders, each marked when the live price reaches its limit. */
export function OrdersPanel({ feed }: { feed: TradingFeed }) {
    const snapshot = useFeed(feed);
    return (
        <table className={styles.table}>
            <thead>
                <tr className={styles.headRow}>
                    <th className={styles.headStart}>Order</th>
                    <th className={styles.headStart}>Side</th>
                    <th className={styles.headStart}>Symbol</th>
                    <th className={styles.head}>Qty</th>
                    <th className={styles.head}>Limit</th>
                    <th className={styles.head}>Last</th>
                    <th className={styles.head}>Status</th>
                </tr>
            </thead>
            <tbody>
                {snapshot.orders.map((order) => {
                    const price =
                        instrumentOf(snapshot, order.symbol)?.price ??
                        order.price;
                    const ready = marketable(order, price);
                    return (
                        <tr key={order.id} className={styles.row}>
                            <td className={styles.cellStart}>{order.id}</td>
                            <td className={styles.sideCell(order.side)}>
                                {order.side}
                            </td>
                            <td className={styles.cellStart}>
                                <span className={styles.symbol}>
                                    {order.symbol}
                                </span>
                            </td>
                            <td className={styles.cell}>
                                {formatSize(order.quantity)}
                            </td>
                            <td className={styles.cell}>
                                {formatPrice(order.price)}
                            </td>
                            <td className={styles.cell}>
                                {formatPrice(price)}
                            </td>
                            <td className={styles.statusCell(ready)}>
                                {ready ? "At limit" : "Working"}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/** The news wire, newest first; a headline's symbol selects its instrument. */
export function NewsPanel({
    feed,
    onSelect,
}: {
    feed: TradingFeed;
    onSelect: (symbol: string) => void;
}) {
    const { news } = useFeed(feed);
    return (
        <ol aria-label="Headlines" className={styles.news}>
            {news.map((headline) => (
                <li key={headline.id} className={styles.headline}>
                    <span className={styles.tapeTime}>{headline.time}</span>
                    <button
                        type="button"
                        onClick={() => onSelect(headline.symbol)}
                        className={styles.headlineSymbol(headline.tone)}
                    >
                        {headline.symbol}
                    </button>
                    <span className={styles.headlineText}>{headline.text}</span>
                </li>
            ))}
        </ol>
    );
}
