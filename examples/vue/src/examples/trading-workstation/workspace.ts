import {
    createModel,
    type LayoutJson,
    type Model,
} from "@fragiola/dockable-vue";
import {
    DEFAULT_SYMBOL,
    instrumentOf,
    type TradingFeed,
    totalPnlOf,
} from "../_kit/trading";

// The workstation's state outside the feed: the tab registry, the default layout with its save
// and restore, the instrument the desk follows (the chart tab's data) and the badges the tabs
// read (the positions' profit sign and the unread headlines, written into those tabs' data).

/** What the chart tab keeps in its `data`: the instrument it follows. */
export interface ChartData {
    symbol: string;
}

/** What the positions tab keeps: the sign of the open profit or loss. */
export interface PositionsData {
    pnl?: "up" | "down";
}

/** What the news tab keeps: how many headlines arrived since it was last looked at. */
export interface NewsData {
    unread?: number;
}

export type Types = {
    tabs: {
        watchlist: undefined;
        news: NewsData;
        chart: ChartData;
        book: undefined;
        trades: undefined;
        positions: PositionsData;
        orders: undefined;
    };
};

export const CHART_TAB = "chart";
export const POSITIONS_TAB = "positions";
export const NEWS_TAB = "news";

// Every tab has an explicit id: resetting the layout (`layout.load`) keeps their content.
export const defaultLayout: LayoutJson<Types> = {
    version: 1,
    // a desk's panels are not closed, and any of them may pop out into its own window
    defaults: { tab: { closable: false, poppable: true } },
    borders: [
        {
            location: "bottom",
            selected: 0,
            size: 150,
            children: [
                {
                    id: POSITIONS_TAB,
                    component: "positions",
                    label: "Positions",
                    data: {},
                },
                { id: "orders", component: "orders", label: "Orders" },
            ],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "market",
                weight: 26,
                children: [
                    {
                        id: "watchlist",
                        component: "watchlist",
                        label: "Watchlist",
                    },
                    {
                        id: NEWS_TAB,
                        component: "news",
                        label: "News",
                        data: {},
                    },
                ],
            },
            {
                type: "tabset",
                id: "chart-area",
                weight: 46,
                children: [
                    {
                        id: CHART_TAB,
                        component: "chart",
                        // the chart tab is named after the instrument it follows
                        label: DEFAULT_SYMBOL,
                        data: { symbol: DEFAULT_SYMBOL },
                    },
                ],
            },
            {
                type: "tabset",
                id: "depth",
                weight: 28,
                children: [
                    { id: "book", component: "book", label: "Order book" },
                    { id: "trades", component: "trades", label: "Trades" },
                ],
            },
        ],
    },
};

/** The instrument the desk follows: the chart tab's. */
export function selectedSymbol(model: Model<Types>): string {
    const chart = model.get("node-by", { id: CHART_TAB });
    return chart?.type === "tab" && chart.component === "chart"
        ? chart.data.symbol
        : DEFAULT_SYMBOL;
}

/** Follows another instrument: the chart tab's data, and its name. */
export function selectSymbol(model: Model<Types>, symbol: string) {
    model.run("tab.set-data", { tabId: CHART_TAB, data: { symbol } });
    model.run("tab.rename", { tabId: CHART_TAB, label: symbol });
}

/**
 * Writes the badges into the tabs' data when they change (not on every tick): the positions'
 * profit sign, and the headlines the news tab has not shown yet (none while it is selected).
 * Returns the function that stops it.
 */
export function trackBadges(
    model: Model<Types>,
    feed: TradingFeed,
): () => void {
    let seen = feed.getSnapshot().news[0]?.id ?? 0;
    let writing = false;
    const write = (tabId: string, key: "pnl" | "unread", value: unknown) => {
        const node = model.get("node-by", { id: tabId });
        if (node?.type !== "tab") return;
        const data: Record<string, unknown> = { ...node.data };
        if (data[key] === value) return;
        model.run("tab.set-data", { tabId, data: { [key]: value } });
    };
    const update = () => {
        if (writing) return;
        writing = true;
        const snapshot = feed.getSnapshot();
        const latest = snapshot.news[0]?.id ?? 0;
        if (
            model.get("node-by", { id: NEWS_TAB }) &&
            model.is("tab-selected", { tabId: NEWS_TAB })
        ) {
            seen = latest;
        }
        write(
            NEWS_TAB,
            "unread",
            snapshot.news.filter((headline) => headline.id > seen).length,
        );
        write(POSITIONS_TAB, "pnl", totalPnlOf(snapshot) >= 0 ? "up" : "down");
        writing = false;
    };
    update();
    const stopFeed = feed.subscribe(update);
    const stopModel = model.subscribe((event) => {
        if (!event.transient) update();
    });
    return () => {
        stopFeed();
        stopModel();
    };
}

// ── Save and restore ────────────────────────────────────────────────────────

const STORAGE_KEY = "dockable-docs:trading-workstation:layout:v1";

/**
 * The model, from the layout saved on the last visit or the default one (also when the saved one
 * is not valid, or follows an instrument the desk no longer has). Storage may be unavailable.
 */
export function restoreModel(
    isKnown: (symbol: string) => boolean,
): Model<Types> {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const model = createModel<Types>(JSON.parse(saved));
            if (isKnown(selectedSymbol(model))) return model;
        }
    } catch {
        // blocked storage, or a layout that does not load: the default one
    }
    return createModel<Types>(defaultLayout);
}

export function saveLayout(model: Model<Types>) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(model.get("layout-json")),
        );
    } catch {
        // storage full or blocked: the layout just is not remembered
    }
}

export function forgetLayout() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // nothing to forget
    }
}

/** Whether the feed has this instrument. */
export function knownSymbol(feed: TradingFeed) {
    return (symbol: string) =>
        instrumentOf(feed.getSnapshot(), symbol) !== undefined;
}
