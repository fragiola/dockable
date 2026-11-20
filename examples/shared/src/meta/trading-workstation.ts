import type { ExampleMeta } from "../meta-types";

export default {
    title: "Trading workstation",
    description:
        "A live trading desk: a watchlist, a candle chart, an order book, a trades tape, positions with live P&L and a news wire tick a few times a second, while every panel can be dragged to another tabset, an edge or the bottom border, maximized or popped out into a window.",
    category: "apps",
    order: 7,
    features: [
        "Dockable.Borders",
        "Dockable.Popout",
        "PopoutTrigger",
        "tabset.maximize",
        "typed data",
        "tab.set-data",
        "tab.rename",
        "model.subscribe",
        "useModelState",
        "layout.load",
        "localStorage",
        "SVG charts",
    ],
    docs: "/docs/guides/status-aware-tabs",
    layout: "fill",
    height: 600,
} satisfies ExampleMeta;
