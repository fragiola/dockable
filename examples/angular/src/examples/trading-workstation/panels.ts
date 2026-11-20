import {
    Component,
    computed,
    effect,
    input,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type BookLevel,
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
    type Snapshot,
    type TradingFeed,
    totalPnlOf,
} from "../_kit/trading";
import * as styles from "./styles";

// The content of each tab. Every panel subscribes to the feed and unsubscribes when it is
// destroyed (`injectFeed` does both), so a panel keeps ticking wherever its tab is moved: another
// tabset, a border, a maximized tabset or a popout window. The charts are plain SVG.

/**
 * The feed's current snapshot, as a signal that follows it (subscribed while the calling
 * component lives). Call it in an injection context, with a signal of the feed input.
 */
function injectFeed(feed: Signal<TradingFeed>): Signal<Snapshot> {
    const snapshot = signal<Snapshot | undefined>(undefined);
    effect((onCleanup) => {
        const current = feed();
        untracked(() => snapshot.set(current.getSnapshot()));
        onCleanup(current.subscribe(() => snapshot.set(current.getSnapshot())));
    });
    // before the first effect run, read the feed directly
    return computed(() => snapshot() ?? feed().getSnapshot());
}

/** Up, down or flat, as the tone the styles colour. */
const toneOf = (value: number) =>
    value > 0 ? "up" : value < 0 ? "down" : "flat";

/** A line of the last closes, drawn in a 100 × 24 box stretched to the element. */
function sparklineOf(instrument: Instrument): string {
    const closes = instrument.candles.map((candle) => candle.close);
    const low = Math.min(...closes);
    const range = Math.max(...closes) - low || 1;
    return closes
        .map(
            (close, i) =>
                `${(i / Math.max(1, closes.length - 1)) * 100},${22 - ((close - low) / range) * 20}`,
        )
        .join(" ");
}

/** The instruments, live; a row makes its instrument the one the chart and the book follow. */
@Component({
    selector: "example-trading-watchlist",
    host: { class: "contents" },
    template: `
        <ul aria-label="Watchlist" [class]="styles.watchlist">
            @for (instrument of snapshot().instruments; track instrument.symbol) {
                @let change = changeOf(instrument);
                <li>
                    <button
                        type="button"
                        [attr.aria-pressed]="instrument.symbol === selected()"
                        [class]="styles.watchRow"
                        (click)="select.emit(instrument.symbol)"
                    >
                        <span [class]="styles.watchName">
                            <span [class]="styles.symbol">{{ instrument.symbol }}</span>
                            <span [class]="styles.instrumentName">{{ instrument.name }}</span>
                        </span>
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 100 24"
                            preserveAspectRatio="none"
                            [class]="styles.sparkline(toneOf(change))"
                        >
                            <polyline [attr.points]="sparklineOf(instrument)" [class]="styles.sparklineLine" />
                        </svg>
                        <span [class]="styles.watchFigures">
                            <span [class]="styles.price(instrument.direction)">{{
                                formatPrice(instrument.price)
                            }}</span>
                            <span [class]="styles.change(toneOf(change))">{{ formatPercent(change) }}</span>
                        </span>
                    </button>
                </li>
            }
        </ul>
    `,
})
export class WatchlistPanel {
    readonly feed = input.required<TradingFeed>();
    readonly selected = input.required<string>();
    readonly select = output<string>();
    protected readonly styles = styles;
    protected readonly snapshot = injectFeed(this.feed);
    protected readonly changeOf = changeOf;
    protected readonly toneOf = toneOf;
    protected readonly sparklineOf = sparklineOf;
    protected readonly formatPrice = formatPrice;
    protected readonly formatPercent = formatPercent;
}

/** Each candle is 10 units wide in the chart's box; prices map onto a height of 100. */
const SLOT = 10;
const WIDTH = CANDLES * SLOT;

/** The selected instrument's candles, drawn as SVG, with its last price marked. */
@Component({
    selector: "example-trading-chart",
    host: { class: "contents" },
    template: `
        @if (chart(); as chart) {
            <div [class]="styles.chartPanel">
                <div [class]="styles.chartHeader">
                    <span [class]="styles.chartSymbol">{{ chart.instrument.symbol }}</span>
                    <span [class]="styles.instrumentName">{{ chart.instrument.name }}</span>
                    <span data-testid="last-price" [class]="styles.chartPrice(chart.instrument.direction)">{{
                        formatPrice(chart.instrument.price)
                    }}</span>
                    <span [class]="styles.change(toneOf(chart.change))">{{ formatPercent(chart.change) }}</span>
                    <span [class]="styles.chartRange">{{
                        "H " + formatPrice(chart.high) + " · L " + formatPrice(chart.low)
                    }}</span>
                </div>
                <div [class]="styles.plot">
                    <svg
                        role="img"
                        [attr.aria-label]="chart.instrument.symbol + ' price, the last ' + CANDLES + ' candles'"
                        [attr.viewBox]="'0 0 ' + WIDTH + ' 100'"
                        preserveAspectRatio="none"
                        [class]="styles.plotSvg"
                    >
                        @for (line of [25, 50, 75]; track line) {
                            <line
                                x1="0"
                                [attr.x2]="WIDTH"
                                [attr.y1]="line"
                                [attr.y2]="line"
                                [class]="styles.gridLine"
                            />
                        }
                        <!-- a candle is its slot -->
                        @for (candle of chart.candles; track $index) {
                            <g [class]="styles.candle(candle.tone)">
                                <line
                                    [attr.x1]="candle.x"
                                    [attr.x2]="candle.x"
                                    [attr.y1]="candle.high"
                                    [attr.y2]="candle.low"
                                    [class]="styles.wick"
                                />
                                <rect
                                    [attr.x]="candle.x - SLOT * 0.3"
                                    [attr.width]="SLOT * 0.6"
                                    [attr.y]="candle.top"
                                    [attr.height]="candle.height"
                                />
                            </g>
                        }
                        <line
                            x1="0"
                            [attr.x2]="WIDTH"
                            [attr.y1]="chart.lastY"
                            [attr.y2]="chart.lastY"
                            [class]="styles.lastLine(chart.instrument.direction)"
                        />
                    </svg>
                    <!-- the label is HTML, so the stretched SVG does not stretch its text -->
                    <span
                        aria-hidden="true"
                        [style.top.%]="chart.lastY"
                        [class]="styles.lastLabel(chart.instrument.direction)"
                        >{{ formatPrice(chart.instrument.price) }}</span
                    >
                </div>
            </div>
        }
    `,
})
export class ChartPanel {
    readonly feed = input.required<TradingFeed>();
    readonly symbol = input.required<string>();
    protected readonly styles = styles;
    protected readonly CANDLES = CANDLES;
    protected readonly SLOT = SLOT;
    protected readonly WIDTH = WIDTH;
    protected readonly toneOf = toneOf;
    protected readonly formatPrice = formatPrice;
    protected readonly formatPercent = formatPercent;
    private readonly snapshot = injectFeed(this.feed);
    protected readonly chart = computed(() => {
        const instrument = instrumentOf(this.snapshot(), this.symbol());
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
}

/** One side of the book, a bar per level as wide as its share of the side's total. */
@Component({
    selector: "example-trading-book-side",
    host: { class: "contents" },
    template: `
        <ol [attr.aria-label]="side() === 'bid' ? 'Bids' : 'Asks'" [class]="styles.bookSide(side())">
            @for (level of levels(); track level.price; let index = $index) {
                <li [attr.data-testid]="index === 0 ? 'best-' + side() : null" [class]="styles.bookLevel">
                    <span
                        aria-hidden="true"
                        [style.width.%]="(level.total / total()) * 100"
                        [class]="styles.depthBar(side())"
                    ></span>
                    <span [class]="styles.bookPrice(side())">{{ formatPrice(level.price) }}</span>
                    <span [class]="styles.bookSize">{{ formatSize(level.size) }}</span>
                    <span [class]="styles.bookTotal">{{ formatSize(level.total) }}</span>
                </li>
            }
        </ol>
    `,
})
export class BookSide {
    readonly levels = input.required<readonly BookLevel[]>();
    readonly side = input.required<"bid" | "ask">();
    protected readonly styles = styles;
    protected readonly formatPrice = formatPrice;
    protected readonly formatSize = formatSize;
    protected readonly total = computed(() =>
        Math.max(1, ...this.levels().map((level) => level.total)),
    );
}

/** The book of the selected instrument: asks above the spread, bids below. */
@Component({
    selector: "example-trading-book",
    imports: [BookSide],
    host: { class: "contents" },
    template: `
        @if (book(); as book) {
            <div [class]="styles.bookPanel">
                <div [class]="styles.bookHeader">
                    <span data-testid="book-symbol" [class]="styles.symbol">{{ book.instrument.symbol }}</span>
                    <span [class]="styles.bookColumns">Price · Size · Total</span>
                </div>
                <example-trading-book-side [levels]="book.asks" side="ask" />
                <div [class]="styles.spread">
                    <span [class]="styles.price(book.instrument.direction)">{{
                        formatPrice(book.instrument.price)
                    }}</span>
                    <span data-testid="book-spread" [class]="styles.spreadValue">{{
                        "spread " + formatPrice(book.spread)
                    }}</span>
                </div>
                <example-trading-book-side [levels]="book.bids" side="bid" />
            </div>
        }
    `,
})
export class OrderBookPanel {
    readonly feed = input.required<TradingFeed>();
    readonly symbol = input.required<string>();
    protected readonly styles = styles;
    protected readonly formatPrice = formatPrice;
    private readonly snapshot = injectFeed(this.feed);
    protected readonly book = computed(() => {
        const snapshot = this.snapshot();
        const instrument = instrumentOf(snapshot, this.symbol());
        if (!instrument) return undefined;
        const { bids, asks, spread } = bookOf(instrument, snapshot.tick, 8);
        return { instrument, bids, asks: [...asks].reverse(), spread };
    });
}

/** The selected instrument's prints, newest first. */
@Component({
    selector: "example-trading-trades",
    host: { class: "contents" },
    template: `
        <ol [attr.aria-label]="symbol() + ' trades'" [class]="styles.tape">
            @for (trade of trades(); track trade.id) {
                <li [class]="styles.tapeRow">
                    <span [class]="styles.tapeTime">{{ trade.time }}</span>
                    <span [class]="styles.tradePrice(trade.side)">{{ formatPrice(trade.price) }}</span>
                    <span [class]="styles.bookSize">{{ formatSize(trade.size) }}</span>
                </li>
            }
        </ol>
    `,
})
export class TradesPanel {
    readonly feed = input.required<TradingFeed>();
    readonly symbol = input.required<string>();
    protected readonly styles = styles;
    protected readonly formatPrice = formatPrice;
    protected readonly formatSize = formatSize;
    private readonly snapshot = injectFeed(this.feed);
    protected readonly trades = computed(
        () => this.snapshot().trades[this.symbol()] ?? [],
    );
}

/** The open positions, valued at the live prices. */
@Component({
    selector: "example-trading-positions",
    host: { class: "contents" },
    template: `
        <table [class]="styles.table">
            <thead>
                <tr [class]="styles.headRow">
                    <th [class]="styles.headStart">Symbol</th>
                    <th [class]="styles.head">Qty</th>
                    <th [class]="styles.head">Avg</th>
                    <th [class]="styles.head">Last</th>
                    <th [class]="styles.head">P&amp;L</th>
                </tr>
            </thead>
            <tbody>
                @for (row of rows(); track row.position.symbol) {
                    <tr [class]="styles.row">
                        <td [class]="styles.cellStart">
                            <span [class]="styles.symbol">{{ row.position.symbol }}</span>
                        </td>
                        <td [class]="styles.cell">{{ formatSize(row.position.quantity) }}</td>
                        <td [class]="styles.cell">{{ formatPrice(row.position.cost) }}</td>
                        <td [class]="styles.cell">{{ formatPrice(row.price) }}</td>
                        <td [class]="styles.pnlCell(toneOf(row.pnl))">{{ formatSigned(row.pnl) }}</td>
                    </tr>
                }
            </tbody>
            <tfoot>
                <tr [class]="styles.footRow">
                    <td [class]="styles.cellStart" colspan="4">Open P&amp;L</td>
                    <td data-testid="total-pnl" [class]="styles.pnlCell(toneOf(total()))">
                        {{ formatSigned(total()) }}
                    </td>
                </tr>
            </tfoot>
        </table>
    `,
})
export class PositionsPanel {
    readonly feed = input.required<TradingFeed>();
    protected readonly styles = styles;
    protected readonly toneOf = toneOf;
    protected readonly formatPrice = formatPrice;
    protected readonly formatSigned = formatSigned;
    protected readonly formatSize = formatSize;
    private readonly snapshot = injectFeed(this.feed);
    protected readonly rows = computed(() => {
        const snapshot = this.snapshot();
        return snapshot.positions.map((position) => {
            const price =
                instrumentOf(snapshot, position.symbol)?.price ?? position.cost;
            return { position, price, pnl: pnlOf(position, price) };
        });
    });
    protected readonly total = computed(() =>
        this.rows().reduce((sum, row) => sum + row.pnl, 0),
    );
}

/** The working orders, each marked when the live price reaches its limit. */
@Component({
    selector: "example-trading-orders",
    host: { class: "contents" },
    template: `
        <table [class]="styles.table">
            <thead>
                <tr [class]="styles.headRow">
                    <th [class]="styles.headStart">Order</th>
                    <th [class]="styles.headStart">Side</th>
                    <th [class]="styles.headStart">Symbol</th>
                    <th [class]="styles.head">Qty</th>
                    <th [class]="styles.head">Limit</th>
                    <th [class]="styles.head">Last</th>
                    <th [class]="styles.head">Status</th>
                </tr>
            </thead>
            <tbody>
                @for (row of rows(); track row.order.id) {
                    <tr [class]="styles.row">
                        <td [class]="styles.cellStart">{{ row.order.id }}</td>
                        <td [class]="styles.sideCell(row.order.side)">{{ row.order.side }}</td>
                        <td [class]="styles.cellStart">
                            <span [class]="styles.symbol">{{ row.order.symbol }}</span>
                        </td>
                        <td [class]="styles.cell">{{ formatSize(row.order.quantity) }}</td>
                        <td [class]="styles.cell">{{ formatPrice(row.order.price) }}</td>
                        <td [class]="styles.cell">{{ formatPrice(row.price) }}</td>
                        <td [class]="styles.statusCell(row.ready)">{{ row.ready ? "At limit" : "Working" }}</td>
                    </tr>
                }
            </tbody>
        </table>
    `,
})
export class OrdersPanel {
    readonly feed = input.required<TradingFeed>();
    protected readonly styles = styles;
    protected readonly formatPrice = formatPrice;
    protected readonly formatSize = formatSize;
    private readonly snapshot = injectFeed(this.feed);
    protected readonly rows = computed(() => {
        const snapshot = this.snapshot();
        return snapshot.orders.map((order) => {
            const price =
                instrumentOf(snapshot, order.symbol)?.price ?? order.price;
            return { order, price, ready: marketable(order, price) };
        });
    });
}

/** The news wire, newest first; a headline's symbol selects its instrument. */
@Component({
    selector: "example-trading-news",
    host: { class: "contents" },
    template: `
        <ol aria-label="Headlines" [class]="styles.news">
            @for (headline of snapshot().news; track headline.id) {
                <li [class]="styles.headline">
                    <span [class]="styles.tapeTime">{{ headline.time }}</span>
                    <button
                        type="button"
                        [class]="styles.headlineSymbol(headline.tone)"
                        (click)="select.emit(headline.symbol)"
                    >
                        {{ headline.symbol }}
                    </button>
                    <span [class]="styles.headlineText">{{ headline.text }}</span>
                </li>
            }
        </ol>
    `,
})
export class NewsPanel {
    readonly feed = input.required<TradingFeed>();
    readonly select = output<string>();
    protected readonly styles = styles;
    protected readonly snapshot = injectFeed(this.feed);
}

/** The account line: the market clock and the open P&L, updated by the feed alone. */
@Component({
    selector: "example-trading-account",
    host: { class: "contents" },
    template: `
        <span [class]="styles.account">
            <time data-testid="feed-clock" [class]="styles.clock">{{ snapshot().time }}</time>
            <span [class]="styles.accountTerm">Open P&amp;L</span>
            <span [class]="styles.accountPnl(pnl() >= 0 ? 'up' : 'down')">{{ formatSigned(pnl()) }}</span>
        </span>
    `,
})
export class Account {
    readonly feed = input.required<TradingFeed>();
    protected readonly styles = styles;
    protected readonly formatSigned = formatSigned;
    protected readonly snapshot = injectFeed(this.feed);
    protected readonly pnl = computed(() => totalPnlOf(this.snapshot()));
}
