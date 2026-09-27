import type { ExampleMeta } from "../meta-types";

export default {
    title: "Hairline splitter",
    description:
        "A VS Code-style 1px splitter with a wider invisible grab area, filled only while dragging or focused from the keyboard.",
    level: "basic",
    order: 3,
    features: [
        "renderSplitter",
        "data-dragging",
        "data-orientation",
        "::after",
    ],
    docs: "/docs/guides/splitters",
} satisfies ExampleMeta;
