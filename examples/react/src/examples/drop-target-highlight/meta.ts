import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drop target highlight",
    description:
        "The tabset under a drag glows, the side it would dock to lights up, and a drop into a tab strip shows a caret at the insertion point. All from data attributes, with no outline at all.",
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
