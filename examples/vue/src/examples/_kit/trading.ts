// Demo data for the trading workstation: fictional instruments whose prices walk at random, their
// candles, an order book and a trades tape around each price, a few positions and working orders,
// and a news wire. A small external store (subscribe / getSnapshot) fed by a timer, a few ticks a
// second, one notification per tick. Seeded (mulberry32): the same seed gives the same market and
// the same ticks. The feed skips its ticks while the document is hidden. Nothing here knows about
// Dockable or about a framework.

/** One price bar: a candle closes every {@link TICKS_PER_CANDLE} ticks. */
export interface Candle {
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
}

export interface Instrument {
    /** fictional: no real company */
    readonly symbol: string;
    readonly name: string;
    readonly price: number;
    /** the price the session opened at */
    readonly open: number;
    /** the last candles, oldest first; the last one is still forming */
    readonly candles: readonly Candle[];
    /** how the last tick moved the price */
    readonly direction: "up" | "down";
}

export interface Trade {
    readonly id: number;
    readonly time: string;
    readonly price: number;
    readonly size: number;
    /** whether the buyer or the seller took the price */
    readonly side: "buy" | "sell";
}

export interface Position {
    readonly symbol: string;
    readonly quantity: number;
    /** the average price paid */
    readonly cost: number;
}

export interface Order {
    readonly id: string;
    readonly symbol: string;
    readonly side: "buy" | "sell";
    readonly quantity: number;
    /** the limit price */
    readonly price: number;
}

export interface Headline {
    readonly id: number;
    readonly time: string;
    readonly symbol: string;
    readonly text: string;
    readonly tone: "up" | "down";
}

export interface Snapshot {
    readonly tick: number;
    /** the simulated market clock (a second a tick) */
    readonly time: string;
    readonly instruments: readonly Instrument[];
    /** the last trades of each instrument, newest first */
    readonly trades: Readonly<Record<string, readonly Trade[]>>;
    readonly positions: readonly Position[];
    readonly orders: readonly Order[];
    /** the news wire, newest first */
    readonly news: readonly Headline[];
}

export interface BookLevel {
    readonly price: number;
    readonly size: number;
    /** the size from the best price to this level */
    readonly total: number;
}

/** How often the feed ticks while playing, in milliseconds (four ticks a second). */
export const TICK_MS = 250;

/** How many candles an instrument keeps. */
export const CANDLES = 36;

/** How many ticks make one candle. */
export const TICKS_PER_CANDLE = 6;

const TRADES = 40;
const NEWS = 30;

/** A seeded random source in [0, 1) (mulberry32): the same seed, the same numbers. */
export function randomSource(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let x = state;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

/** The instruments the desk watches: fictional names, a starting price and a typical move. */
export const UNIVERSE = [
    { symbol: "ARBX", name: "Arbex Systems", price: 182.4, step: 0.0016 },
    { symbol: "CORQ", name: "Corquay Energy", price: 64.15, step: 0.002 },
    { symbol: "DXEL", name: "Daxel Robotics", price: 312.8, step: 0.0022 },
    { symbol: "FENZ", name: "Fenzo Bio", price: 27.62, step: 0.003 },
    { symbol: "GLMR", name: "Galmor Networks", price: 98.3, step: 0.0018 },
    { symbol: "JORV", name: "Jorvan Motors", price: 145.05, step: 0.0021 },
    { symbol: "KLXN", name: "Kelux Logistics", price: 51.9, step: 0.0017 },
    { symbol: "QURA", name: "Qurant Foods", price: 76.44, step: 0.0012 },
] as const;

export const DEFAULT_SYMBOL = "DXEL";

const POSITIONS: readonly Position[] = [
    { symbol: "ARBX", quantity: 120, cost: 179.8 },
    { symbol: "DXEL", quantity: 40, cost: 316.25 },
    { symbol: "FENZ", quantity: 900, cost: 26.9 },
    { symbol: "KLXN", quantity: -300, cost: 52.4 },
];

const ORDERS: readonly Order[] = [
    { id: "O-1041", symbol: "DXEL", side: "buy", quantity: 25, price: 309.5 },
    { id: "O-1042", symbol: "CORQ", side: "sell", quantity: 400, price: 65.2 },
    { id: "O-1043", symbol: "GLMR", side: "buy", quantity: 150, price: 97.1 },
    { id: "O-1044", symbol: "QURA", side: "sell", quantity: 200, price: 77.3 },
];

const STORIES: readonly { text: string; tone: Headline["tone"] }[] = [
    { text: "raises full-year guidance", tone: "up" },
    { text: "wins a multi-year supply contract", tone: "up" },
    { text: "beats quarterly estimates", tone: "up" },
    { text: "upgraded to buy by a broker", tone: "up" },
    { text: "announces a share buyback", tone: "up" },
    { text: "misses revenue estimates", tone: "down" },
    { text: "delays its product launch", tone: "down" },
    { text: "downgraded to hold by a broker", tone: "down" },
    { text: "chief financial officer steps down", tone: "down" },
    { text: "faces a regulatory review", tone: "down" },
];

/** The price rounded to the cent. */
function cents(value: number): number {
    return Math.round(value * 100) / 100;
}

function clock(seconds: number): string {
    const total = 9 * 3600 + 30 * 60 + seconds;
    return [total / 3600, (total / 60) % 60, total % 60]
        .map((n) => String(Math.floor(n)).padStart(2, "0"))
        .join(":");
}

/** A string's hash, to seed what is derived from an instrument (its order book). */
function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    }
    return h >>> 0;
}

/** The change since the open, as a fraction of the open (0.01 is 1%). */
export function changeOf(instrument: Instrument): number {
    return instrument.price / instrument.open - 1;
}

/** A position's profit or loss at the current price (a short position gains when it falls). */
export function pnlOf(position: Position, price: number): number {
    return (price - position.cost) * position.quantity;
}

export function instrumentOf(
    snapshot: Snapshot,
    symbol: string,
): Instrument | undefined {
    return snapshot.instruments.find((i) => i.symbol === symbol);
}

/** The profit or loss of every position together. */
export function totalPnlOf(snapshot: Snapshot): number {
    let total = 0;
    for (const position of snapshot.positions) {
        const instrument = instrumentOf(snapshot, position.symbol);
        if (instrument) total += pnlOf(position, instrument.price);
    }
    return total;
}

/** Whether a working order would fill at the current price. */
export function marketable(order: Order, price: number): boolean {
    return order.side === "buy" ? price <= order.price : price >= order.price;
}

/**
 * The order book around an instrument's price: `depth` levels a side, a cent apart from the
 * spread, the sizes seeded by the symbol and the tick (so a paused feed shows a still book).
 */
export function bookOf(
    instrument: Instrument,
    tick: number,
    depth = 10,
): { bids: BookLevel[]; asks: BookLevel[]; spread: number } {
    const random = randomSource(hash(instrument.symbol) + tick * 7919);
    const tickSize = instrument.price > 100 ? 0.05 : 0.01;
    const half = Math.max(1, Math.round(random() * 3)) * tickSize;
    const side = (sign: 1 | -1): BookLevel[] => {
        let total = 0;
        return Array.from({ length: depth }, (_, level) => {
            const size = Math.round(50 + random() * 900 * (1 + level / 4));
            total += size;
            return {
                price: cents(
                    instrument.price + sign * (half + level * tickSize),
                ),
                size,
                total,
            };
        });
    };
    const bids = side(-1);
    const asks = side(1);
    const spread = cents((asks[0]?.price ?? 0) - (bids[0]?.price ?? 0));
    return { bids, asks, spread };
}

export function formatPrice(value: number): string {
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** A signed amount: "+1,204.50" or "−88.10" (a real minus sign). */
export function formatSigned(value: number): string {
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${formatPrice(Math.abs(value))}`;
}

/** A signed percentage of a fraction: 0.0123 is "+1.23%". */
export function formatPercent(fraction: number): string {
    const value = fraction * 100;
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatSize(value: number): string {
    return value.toLocaleString("en-US");
}

/** The feed: a store of {@link Snapshot}s that a timer moves while it is started. */
export function createTradingFeed(seed = 167) {
    const random = randomSource(seed);
    let tradeId = 0;
    let newsId = 0;

    const walk = (price: number, step: number) =>
        Math.max(1, cents(price * (1 + (random() - 0.5) * 2 * step)));

    let snapshot: Snapshot = {
        tick: 0,
        time: clock(0),
        instruments: UNIVERSE.map((entry) => ({
            symbol: entry.symbol,
            name: entry.name,
            price: entry.price,
            open: entry.price,
            candles: [
                {
                    open: entry.price,
                    high: entry.price,
                    low: entry.price,
                    close: entry.price,
                },
            ],
            direction: "up" as const,
        })),
        trades: Object.fromEntries(UNIVERSE.map((entry) => [entry.symbol, []])),
        positions: POSITIONS,
        orders: ORDERS,
        news: [],
    };

    const listeners = new Set<() => void>();

    /** One tick: every price moves, candles grow, trades print, now and then a headline. */
    const step = () => {
        const tick = snapshot.tick + 1;
        const time = clock(tick);
        const trades: Record<string, readonly Trade[]> = {};
        const instruments = snapshot.instruments.map((instrument, index) => {
            const entry = UNIVERSE[index];
            const price = walk(instrument.price, entry?.step ?? 0.002);
            const last = instrument.candles[instrument.candles.length - 1];
            const candles =
                tick % TICKS_PER_CANDLE === 0 || !last
                    ? [
                          ...instrument.candles.slice(1 - CANDLES),
                          {
                              open: instrument.price,
                              high: Math.max(instrument.price, price),
                              low: Math.min(instrument.price, price),
                              close: price,
                          },
                      ]
                    : [
                          ...instrument.candles.slice(0, -1),
                          {
                              open: last.open,
                              high: Math.max(last.high, price),
                              low: Math.min(last.low, price),
                              close: price,
                          },
                      ];
            const prints = Math.floor(random() * 3);
            const fresh: Trade[] = [];
            for (let i = 0; i < prints; i++) {
                fresh.push({
                    id: ++tradeId,
                    time,
                    price: cents(price + (random() - 0.5) * 0.1),
                    size: Math.round(1 + random() * 40) * 25,
                    side: random() < 0.5 ? "buy" : "sell",
                });
            }
            trades[instrument.symbol] = [
                ...fresh,
                ...(snapshot.trades[instrument.symbol] ?? []),
            ].slice(0, TRADES);
            return {
                ...instrument,
                price,
                candles,
                direction:
                    price >= instrument.price
                        ? ("up" as const)
                        : ("down" as const),
            };
        });
        let news = snapshot.news;
        if (tick % 10 === 0) {
            const entry = UNIVERSE[Math.floor(random() * UNIVERSE.length)];
            const story = STORIES[Math.floor(random() * STORIES.length)];
            if (entry && story) {
                news = [
                    {
                        id: ++newsId,
                        time,
                        symbol: entry.symbol,
                        text: `${entry.name} ${story.text}`,
                        tone: story.tone,
                    },
                    ...news,
                ].slice(0, NEWS);
            }
        }
        snapshot = { ...snapshot, tick, time, instruments, trades, news };
    };

    // a session already under way: a full chart, a tape and some news before the first frame
    for (let i = 0; i < CANDLES * TICKS_PER_CANDLE; i++) step();

    return {
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => snapshot,
        /** Ticks every `interval` ms (skipped while the page is hidden); returns the stop. */
        start(interval = TICK_MS) {
            const timer = setInterval(() => {
                if (typeof document !== "undefined" && document.hidden) return;
                step();
                for (const listener of listeners) listener();
            }, interval);
            return () => clearInterval(timer);
        },
    };
}

export type TradingFeed = ReturnType<typeof createTradingFeed>;

/** Whether the reader asked for less motion: the feed then starts paused. */
export function prefersReducedMotion(): boolean {
    return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}
