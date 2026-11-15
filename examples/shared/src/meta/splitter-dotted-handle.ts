import type { ExampleMeta } from "../meta-types";

export default {
    title: "Dotted handle",
    description:
        "A splitter with a grip of three dots drawn inside it: children of Dockable.Splitter that turn with its orientation and react to hover and dragging.",
    category: "splitters",
    order: 3,
    features: [
        "Dockable.Splitter",
        "renderSplitter",
        "data-orientation",
        "data-dragging",
    ],
    docs: "/docs/guides/splitters",
} satisfies ExampleMeta;
