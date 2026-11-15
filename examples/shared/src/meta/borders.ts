import type { ExampleMeta } from "../meta-types";

export default {
    title: "Borders",
    description:
        "Side bars with tabs, as in an IDE: an explorer on the left, a terminal below, an outline on the right. Click a border's tab to open its panel beside the layout, again to close it; resize it with its splitter; drag tabs into a border and out of it.",
    category: "borders",
    order: 1,
    features: [
        "Dockable.Borders",
        "Dockable.Border",
        "Dockable.BorderContent",
        "border splitter",
        "data-location",
        "data-open",
        "defaults.border",
        "typed data",
    ],
    docs: "/docs/guides/borders",
} satisfies ExampleMeta;
