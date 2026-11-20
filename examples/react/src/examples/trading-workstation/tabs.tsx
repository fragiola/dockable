"use client";

import {
    type BorderNode,
    type ComponentOf,
    Dockable,
    type RowNode,
    type TabOf,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-react";
import {
    ArrowDownToLine,
    BookOpenText,
    ChartCandlestick,
    ClipboardList,
    Layers,
    List,
    type LucideIcon,
    Maximize2,
    Minimize2,
    Newspaper,
    SquareArrowOutUpRight,
    Wallet,
} from "lucide-react";
import * as styles from "./styles";
import type { Types } from "./workspace";

// The desk's tabsets and its bottom border. A tab shows what its panel reported into its data:
// the positions tab the sign of the open P&L (`data-pnl`), the news tab its unread headlines
// (`data-unread` and a count). Each tabset can pop its selected tab out into a window and be
// maximized; every tab can be dragged to another tabset, an edge or the border.

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    watchlist: List,
    news: Newspaper,
    chart: ChartCandlestick,
    book: Layers,
    trades: BookOpenText,
    positions: Wallet,
    orders: ClipboardList,
};

/** The tab lists' names, by tabset id: a tabset created by a drop is a "Panels" one. */
const TABSET_NAMES: Record<string, string> = {
    market: "Market",
    "chart-area": "Chart",
    depth: "Depth",
};

function TradingTab({ tab }: { tab: TabOf<Types> }) {
    const Icon = ICONS[tab.component];
    // `tab.data` narrows on `tab.component`: only these two carry a badge
    const pnl = tab.component === "positions" ? tab.data.pnl : undefined;
    const unread = tab.component === "news" ? (tab.data.unread ?? 0) : 0;
    return (
        <Dockable.Tab
            node={tab}
            data-pnl={pnl}
            data-unread={unread > 0 ? "" : undefined}
            className={styles.tab}
        >
            <Icon aria-hidden="true" className={styles.tabIcon} />
            <span className={styles.tabName}>{tab.label}</span>
            {pnl ? (
                <span className={styles.pnlBadge(pnl)}>
                    <span aria-hidden="true">{pnl === "up" ? "+" : "−"}</span>
                    <span className={styles.srOnly}>
                        {pnl === "up" ? "in profit" : "at a loss"}
                    </span>
                </span>
            ) : null}
            {unread > 0 ? (
                <span data-testid="unread-count" className={styles.unreadBadge}>
                    {unread}
                    <span className={styles.srOnly}> unread</span>
                </span>
            ) : null}
        </Dockable.Tab>
    );
}

export function TradingTabSet({ node }: { node: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const maximized = model.is("tabset-maximized", { tabsetId: node.id });
    const selected = model.get("selected-tab-by", { tabsetId: node.id });
    const name = selected?.label ?? "";
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label={TABSET_NAMES[node.id] ?? "Panels"}
                    className={styles.tabList}
                >
                    {(tab) => <TradingTab tab={tab} />}
                </Dockable.TabList>
                <div className={styles.tabsetButtons}>
                    {/* pops the selected tab out, or docks it back from a window */}
                    <Dockable.PopoutTrigger
                        className={styles.iconButton}
                        render={(props, state) => (
                            <button
                                {...props}
                                aria-label={
                                    state.mode === "dock"
                                        ? `Dock ${name} back`
                                        : `Pop out ${name}`
                                }
                            />
                        )}
                    >
                        <SquareArrowOutUpRight
                            aria-hidden="true"
                            className={styles.popoutIcon}
                        />
                        <ArrowDownToLine
                            aria-hidden="true"
                            className={styles.dockIcon}
                        />
                    </Dockable.PopoutTrigger>
                    <button
                        type="button"
                        aria-label={maximized ? "Restore" : "Maximize"}
                        aria-pressed={maximized}
                        onClick={() =>
                            model.run("tabset.maximize", {
                                tabsetId: node.id,
                                value: !maximized,
                            })
                        }
                        className={styles.iconButton}
                    >
                        {maximized ? (
                            <Minimize2
                                aria-hidden="true"
                                className={styles.buttonIcon}
                            />
                        ) : (
                            <Maximize2
                                aria-hidden="true"
                                className={styles.buttonIcon}
                            />
                        )}
                    </button>
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
export function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TradingTabSet node={node} />;
}

/** The bottom border's strip: the account's tabs, which open a panel below the desk. */
export function Border({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.Border node={node} className={styles.border}>
            <Dockable.TabList<Types>
                aria-label="Account"
                className={styles.borderTabList}
            >
                {(tab) => <TradingTab tab={tab} />}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

export function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={styles.borderContent}
            renderSplitter={(border) => <Splitter node={border} />}
        />
    );
}

export function Splitter({
    node,
    index,
}: {
    node: RowNode<Types> | BorderNode<Types>;
    index?: number;
}) {
    return (
        <Dockable.Splitter
            node={node}
            index={index}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
