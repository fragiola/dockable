import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drop indicator colours",
    description:
        "The drop indicator says where a tab would land: each region has its colour, and the fill shows the side (into the tabset, beside it, or at the layout's edge).",
    category: "drag-and-drop",
    order: 3,
    features: [
        "DropIndicator",
        "location",
        "kind",
        "useTabSet",
        "data-drop-target",
    ],
    docs: "/docs/guides/drag-and-drop",
} satisfies ExampleMeta;
