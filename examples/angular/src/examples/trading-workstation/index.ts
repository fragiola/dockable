import { Component, DestroyRef, effect, inject, signal } from "@angular/core";
import { DOCKABLE, injectModelState } from "@fragiola/dockable-angular";
import { LucidePause, LucidePlay, LucideRotateCcw } from "@lucide/angular";
import { createTradingFeed, prefersReducedMotion } from "../_kit/trading";
import {
    Account,
    ChartPanel,
    NewsPanel,
    OrderBookPanel,
    OrdersPanel,
    PositionsPanel,
    TradesPanel,
    WatchlistPanel,
} from "./panels";
import * as styles from "./styles";
import { pnlOf, TradingTab, TradingTabSet, unreadOf } from "./tabs";
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
// maximized or popped out into a window, and keeps ticking there: moving a tab never re-creates
// its content. The layout is saved on every change and restored on the next visit.

@Component({
    selector: "example-trading-workstation",
    imports: [
        DOCKABLE,
        LucidePause,
        LucidePlay,
        LucideRotateCcw,
        Account,
        TradingTab,
        TradingTabSet,
        WatchlistPanel,
        NewsPanel,
        ChartPanel,
        OrderBookPanel,
        TradesPanel,
        PositionsPanel,
        OrdersPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.shell">
            <div [class]="styles.toolbar">
                <button type="button" [class]="styles.button" (click)="playing.set(!playing())">
                    @if (playing()) {
                        <svg lucidePause aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        Pause
                    } @else {
                        <svg lucidePlay aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        Play
                    }
                </button>
                <span data-testid="feed-state" [class]="styles.feedState(playing())">
                    <span aria-hidden="true" [class]="styles.feedDot(playing())"></span>
                    {{ playing() ? "Live" : "Paused" }}
                </span>
                <example-trading-account [feed]="feed" />
                <button type="button" [class]="styles.ghostButton" (click)="resetLayout()">
                    <svg lucideRotateCcw aria-hidden="true" [class]="styles.buttonIcon"></svg>
                    Reset layout
                </button>
            </div>
            <div [class]="styles.frame">
                <!-- popoutMirrorRoot copies <html> and <body>'s attributes (the example theme) into
                     each window -->
                <div
                    [dockableRoot]="model"
                    [popoutURL]="popoutURL"
                    popoutMirrorRoot
                    [class]="styles.root"
                >
                    <div dockableBorders>
                        <!-- the bottom border's strip: the account's tabs, which open a panel below
                             the desk -->
                        <ng-template [dockableBordersBar]="model" let-border>
                            <div [dockableBorder]="border" [class]="styles.border">
                                <div dockableTabList aria-label="Account" [class]="styles.borderTabList">
                                    <ng-template [dockableTabListItem]="model" let-tab>
                                        <div
                                            [dockableTab]="tab"
                                            [attr.data-pnl]="pnlOf(tab) ?? null"
                                            [attr.data-unread]="unreadOf(tab) > 0 ? '' : null"
                                            [class]="styles.tab"
                                        >
                                            <example-trading-tab [tab]="tab" />
                                        </div>
                                    </ng-template>
                                </div>
                            </div>
                        </ng-template>
                        <ng-template [dockableBordersContent]="model" let-border>
                            <div [dockableBorderContent]="border" [class]="styles.borderContent">
                                <ng-template dockableBorderSplitter let-node>
                                    <div [dockableSplitter]="node" aria-label="Resize" [class]="styles.splitter">
                                        <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                        <!-- A row's child: a tabset (TradingTabSet, in tabs.ts), or a nested row
                             rendered with these same templates. -->
                        <div dockableRow>
                            <ng-template [dockableRowChild]="model" let-node>
                                @if (node.type === "row") {
                                    <div [dockableRow]="node"></div>
                                } @else {
                                    <example-trading-tabset [node]="node" />
                                }
                            </ng-template>
                            <ng-template dockableRowSplitter let-node="node" let-index="index">
                                <div
                                    [dockableSplitter]="node"
                                    [index]="index"
                                    aria-label="Resize"
                                    [class]="styles.splitter"
                                >
                                    <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <!-- every tab's content, here or in a popout, positioned by the engine -->
                    <ng-template [dockablePanels]="model" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            <!-- tab.data narrows on tab.component: the chart's instrument -->
                            @switch (tab.component) {
                                @case ("watchlist") {
                                    <example-trading-watchlist
                                        [feed]="feed"
                                        [selected]="symbol()"
                                        (select)="select($event)"
                                    />
                                }
                                @case ("news") {
                                    <example-trading-news [feed]="feed" (select)="select($event)" />
                                }
                                @case ("chart") {
                                    <example-trading-chart [feed]="feed" [symbol]="tab.data.symbol" />
                                }
                                @case ("book") {
                                    <example-trading-book [feed]="feed" [symbol]="symbol()" />
                                }
                                @case ("trades") {
                                    <example-trading-trades [feed]="feed" [symbol]="symbol()" />
                                }
                                @case ("positions") {
                                    <example-trading-positions [feed]="feed" />
                                }
                                @case ("orders") {
                                    <example-trading-orders [feed]="feed" />
                                }
                            }
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                    <!-- each popout window: its own rows and drop outline -->
                    <ng-template [dockablePopout]="model" let-layout>
                        <div [dockablePopoutLayout]="layout" [class]="styles.popout">
                            <div dockableRow>
                                <ng-template [dockableRowChild]="model" let-node>
                                    @if (node.type === "row") {
                                        <div [dockableRow]="node"></div>
                                    } @else {
                                        <example-trading-tabset [node]="node" />
                                    }
                                </ng-template>
                                <ng-template dockableRowSplitter let-node="node" let-index="index">
                                    <div
                                        [dockableSplitter]="node"
                                        [index]="index"
                                        aria-label="Resize"
                                        [class]="styles.splitter"
                                    >
                                        <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                                    </div>
                                </ng-template>
                            </div>
                            <div
                                dockableDropIndicator
                                #popoutIndicator="dockableDropIndicator"
                                [class]="styles.dropIndicator(popoutIndicator.state())"
                            ></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class TradingWorkstation {
    protected readonly styles = styles;
    protected readonly pnlOf = pnlOf;
    protected readonly unreadOf = unreadOf;
    // The popout host page, served next to the app under its base (Vite's `BASE_URL`).
    protected readonly popoutURL = `${import.meta.env.BASE_URL}popout.html`;
    protected readonly feed = createTradingFeed();
    protected readonly model = restoreModel(knownSymbol(this.feed));
    protected readonly playing = signal(!prefersReducedMotion());
    // the instrument the desk follows is the chart tab's: a commit updates the panels
    protected readonly symbol = injectModelState<Types, string>(
        (_state, model) => selectedSymbol(model),
        { model: this.model },
    );

    constructor() {
        const destroyRef = inject(DestroyRef);
        // the feed: ticking while playing, and always stopped when the example goes
        effect((onCleanup) => {
            if (this.playing()) onCleanup(this.feed.start());
        });
        // the tabs' badges follow the feed and the model
        destroyRef.onDestroy(trackBadges(this.model, this.feed));
        // every change is saved (a drag's transient steps once, at its end)
        destroyRef.onDestroy(
            this.model.subscribe((event) => {
                if (!event.transient) saveLayout(this.model);
            }),
        );
    }

    protected select(symbol: string) {
        selectSymbol(this.model, symbol);
    }

    // the same model loads the default layout: the panels keep their content
    protected resetLayout() {
        forgetLayout();
        this.model.run("layout.load", { layout: defaultLayout });
    }
}
