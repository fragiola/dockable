"use client";

import { Dockable, type TabOf, useModelState } from "@fragiola/dockable-react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
    createTradingFeed,
    formatSigned,
    prefersReducedMotion,
    type TradingFeed,
    totalPnlOf,
} from "../_kit/trading";
import {
    ChartPanel,
    NewsPanel,
    OrderBookPanel,
    OrdersPanel,
    PositionsPanel,
    TradesPanel,
    WatchlistPanel,
} from "./panels";
import * as styles from "./styles";
import { Border, BorderContent, renderNode, Splitter } from "./tabs";
import {
    defaultLayout,
    forgetLayout,
    knownSymbol,
    restoreModel,
    saveLayout,
    selectedSymbol,
    selectSymbol,
    type Types,
    trackBadges,
} from "./workspace";

// A trading desk of dockable panels, all live: a seeded feed ticks a few times a second while
// playing (paused from the start under reduced motion, and skipped while the page is hidden).
// The watchlist chooses the instrument the chart and the order book follow, kept in the chart
// tab's data and its name (`tab.set-data`, `tab.rename`); the positions and news tabs show badges
// their data carries. Every panel can be dragged to another tabset, an edge or the bottom border,
// maximized or popped out into a window, and keeps ticking there: moving a tab never remounts its
// content. The layout is saved on every change and restored on the next visit.

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function TradingWorkstation() {
    const [feed] = useState(createTradingFeed);
    const [model] = useState(() => restoreModel(knownSymbol(feed)));
    const [playing, setPlaying] = useState(() => !prefersReducedMotion());

    // the feed: ticking while playing, and always stopped on unmount
    useEffect(() => (playing ? feed.start() : undefined), [feed, playing]);
    // the tabs' badges follow the feed and the model
    useEffect(() => trackBadges(model, feed), [model, feed]);
    // every change is saved (a drag's transient steps once, at its end)
    useEffect(
        () =>
            model.subscribe((event) => {
                if (!event.transient) saveLayout(model);
            }),
        [model],
    );

    // the instrument the desk follows is the chart tab's: a commit re-renders the panels
    const symbol = useModelState(() => selectedSymbol(model), { model });
    const select = (next: string) => selectSymbol(model, next);

    // the same model loads the default layout: the panels keep their content
    const resetLayout = () => {
        forgetLayout();
        model.run("layout.load", { layout: defaultLayout });
    };

    const renderContent = (tab: TabOf<Types>) => {
        switch (tab.component) {
            case "watchlist":
                return (
                    <WatchlistPanel
                        feed={feed}
                        selected={symbol}
                        onSelect={select}
                    />
                );
            case "news":
                return <NewsPanel feed={feed} onSelect={select} />;
            case "chart":
                return <ChartPanel feed={feed} symbol={tab.data.symbol} />;
            case "book":
                return <OrderBookPanel feed={feed} symbol={symbol} />;
            case "trades":
                return <TradesPanel feed={feed} symbol={symbol} />;
            case "positions":
                return <PositionsPanel feed={feed} />;
            case "orders":
                return <OrdersPanel feed={feed} />;
        }
    };

    return (
        <div className={styles.shell}>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    onClick={() => setPlaying((current) => !current)}
                    className={styles.button}
                >
                    {playing ? (
                        <Pause
                            aria-hidden="true"
                            className={styles.buttonIcon}
                        />
                    ) : (
                        <Play
                            aria-hidden="true"
                            className={styles.buttonIcon}
                        />
                    )}
                    {playing ? "Pause" : "Play"}
                </button>
                <span
                    data-testid="feed-state"
                    className={styles.feedState(playing)}
                >
                    <span
                        aria-hidden="true"
                        className={styles.feedDot(playing)}
                    />
                    {playing ? "Live" : "Paused"}
                </span>
                <Account feed={feed} />
                <button
                    type="button"
                    onClick={resetLayout}
                    className={styles.ghostButton}
                >
                    <RotateCcw
                        aria-hidden="true"
                        className={styles.buttonIcon}
                    />
                    Reset layout
                </button>
            </div>
            <div className={styles.frame}>
                <Dockable.Root
                    model={model}
                    popoutURL={popoutURL}
                    // copies <html> and <body>'s attributes (the example theme) into each window
                    popoutMirrorRoot
                    className={styles.root}
                >
                    <Dockable.Borders<Types>
                        renderBar={(border) => <Border node={border} />}
                        renderContent={(border) => (
                            <BorderContent node={border} />
                        )}
                    >
                        <Dockable.Row<Types>
                            renderSplitter={(props) => <Splitter {...props} />}
                        >
                            {renderNode}
                        </Dockable.Row>
                    </Dockable.Borders>
                    {/* every tab's content, here or in a popout, positioned by the engine */}
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {renderContent(tab)}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                    {/* each popout window: its own rows and drop outline */}
                    <Dockable.Popout<Types> className={styles.popout}>
                        {() => (
                            <>
                                <Dockable.Row<Types>
                                    renderSplitter={(props) => (
                                        <Splitter {...props} />
                                    )}
                                >
                                    {renderNode}
                                </Dockable.Row>
                                <Dockable.DropIndicator
                                    className={styles.dropIndicator}
                                />
                            </>
                        )}
                    </Dockable.Popout>
                </Dockable.Root>
            </div>
        </div>
    );
}

/** The account line: the market clock and the open P&L, re-rendered by the feed alone. */
function Account({ feed }: { feed: TradingFeed }) {
    const snapshot = useSyncExternalStore(
        feed.subscribe,
        feed.getSnapshot,
        feed.getSnapshot,
    );
    const pnl = totalPnlOf(snapshot);
    const tone = pnl >= 0 ? "up" : "down";
    return (
        <span className={styles.account}>
            <time data-testid="feed-clock" className={styles.clock}>
                {snapshot.time}
            </time>
            <span className={styles.accountTerm}>Open P&amp;L</span>
            <span className={styles.accountPnl(tone)}>{formatSigned(pnl)}</span>
        </span>
    );
}
