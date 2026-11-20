import { Component, computed, input } from "@angular/core";
import {
    type ComponentOf,
    DOCKABLE,
    injectDockable,
    injectModelState,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideArrowDownToLine,
    LucideBookOpenText,
    LucideChartCandlestick,
    LucideClipboardList,
    LucideDynamicIcon,
    type LucideIcon,
    LucideLayers,
    LucideList,
    LucideMaximize2,
    LucideMinimize2,
    LucideNewspaper,
    LucideSquareArrowOutUpRight,
    LucideWallet,
} from "@lucide/angular";
import * as styles from "./styles";
import type { Types } from "./workspace";

// The desk's tabsets and its bottom border. A tab shows what its panel reported into its data:
// the positions tab the sign of the open P&L (`data-pnl`), the news tab its unread headlines
// (`data-unread` and a count). Each tabset can pop its selected tab out into a window and be
// maximized; every tab can be dragged to another tabset, an edge or the border.

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    watchlist: LucideList,
    news: LucideNewspaper,
    chart: LucideChartCandlestick,
    book: LucideLayers,
    trades: LucideBookOpenText,
    positions: LucideWallet,
    orders: LucideClipboardList,
};

/** The tab lists' names, by tabset id: a tabset created by a drop is a "Panels" one. */
const TABSET_NAMES: Record<string, string> = {
    market: "Market",
    "chart-area": "Chart",
    depth: "Depth",
};

/** `tab.data` narrows on `tab.component`: only these two carry a badge. */
function pnlOf(tab: TabOf<Types>) {
    return tab.component === "positions" ? tab.data.pnl : undefined;
}

function unreadOf(tab: TabOf<Types>) {
    return tab.component === "news" ? (tab.data.unread ?? 0) : 0;
}

/** What a tab shows inside its `[dockableTab]` element: its icon, its name and its badge. */
@Component({
    selector: "example-trading-tab",
    imports: [LucideDynamicIcon],
    host: { class: "contents" },
    template: `
        <svg [lucideIcon]="ICONS[tab().component]" aria-hidden="true" [class]="styles.tabIcon"></svg>
        <span [class]="styles.tabName">{{ tab().label }}</span>
        @if (pnl(); as pnl) {
            <span [class]="styles.pnlBadge(pnl)">
                <span aria-hidden="true">{{ pnl === "up" ? "+" : "−" }}</span>
                <span [class]="styles.srOnly">{{ pnl === "up" ? "in profit" : "at a loss" }}</span>
            </span>
        }
        @if (unread() > 0) {
            <span data-testid="unread-count" [class]="styles.unreadBadge"
                >{{ unread() }}<span [class]="styles.srOnly"> unread</span></span
            >
        }
    `,
})
export class TradingTab {
    readonly tab = input.required<TabOf<Types>>();
    protected readonly styles = styles;
    protected readonly ICONS = ICONS;
    protected readonly pnl = computed(() => pnlOf(this.tab()));
    protected readonly unread = computed(() => unreadOf(this.tab()));
}

@Component({
    selector: "example-trading-tabset",
    imports: [
        DOCKABLE,
        TradingTab,
        LucideArrowDownToLine,
        LucideSquareArrowOutUpRight,
        LucideMaximize2,
        LucideMinimize2,
    ],
    host: { class: "contents" },
    template: `
        <div [dockableTabSet]="node()" [class]="styles.tabset">
            <div [class]="styles.strip">
                <div dockableTabList [attr.aria-label]="tabListName()" [class]="styles.tabList">
                    <ng-template [dockableTabListItem]="model()" let-tab>
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
                <div [class]="styles.tabsetButtons">
                    <!-- pops the selected tab out, or docks it back from a window -->
                    <button
                        dockablePopoutTrigger
                        #trigger="dockablePopoutTrigger"
                        [attr.aria-label]="
                            trigger.state()?.mode === 'dock' ? 'Dock ' + name() + ' back' : 'Pop out ' + name()
                        "
                        [class]="styles.iconButton"
                    >
                        <svg lucideSquareArrowOutUpRight aria-hidden="true" [class]="styles.popoutIcon"></svg>
                        <svg lucideArrowDownToLine aria-hidden="true" [class]="styles.dockIcon"></svg>
                    </button>
                    <button
                        type="button"
                        [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'"
                        [attr.aria-pressed]="maximized()"
                        [class]="styles.iconButton"
                        (click)="toggleMaximized()"
                    >
                        @if (maximized()) {
                            <svg lucideMinimize2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        } @else {
                            <svg lucideMaximize2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        }
                    </button>
                </div>
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
export class TradingTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    protected readonly pnlOf = pnlOf;
    protected readonly unreadOf = unreadOf;
    protected readonly model = injectDockable<Types>().model;
    protected readonly tabListName = computed(
        () => TABSET_NAMES[this.node().id] ?? "Panels",
    );
    // maximizing changes no input of this component: the signal follows the model
    protected readonly maximized = injectModelState<Types, boolean>(
        (_state, model) =>
            model.is("tabset-maximized", { tabsetId: this.node().id }),
    );
    // a new tabset node (another selected tab) computes it again
    protected readonly name = computed(
        () =>
            this.model().get("selected-tab-by", { tabsetId: this.node().id })
                ?.label ?? "",
    );

    protected toggleMaximized() {
        this.model().run("tabset.maximize", {
            tabsetId: this.node().id,
            value: !this.maximized(),
        });
    }
}

export { pnlOf, unreadOf };
