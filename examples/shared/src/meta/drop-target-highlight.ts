import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drop target highlight",
    description:
        "The part of the tabset a drag would take lights up above its panel: all of it, or the half for a side. A drop into a tab strip shows a caret instead.",
    category: "drag-and-drop",
    order: 2,
    features: [
        "data-drop-target",
        "data-drop-location",
        "useTabSet",
        "TabList dropIndex",
    ],
    docs: "/docs/guides/drop-zones",
} satisfies ExampleMeta;
