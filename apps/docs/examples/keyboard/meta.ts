import type { ExampleMeta } from "../meta-types";

export default {
    title: "Keyboard",
    description:
        "Arrows and Home/End in the strip, splitter resizing from the keyboard, and next/previous tabset. A tooltip on each tab shows its aria-keyshortcuts.",
    level: "basic",
    order: 10,
    features: ["keyMap", "aria-keyshortcuts", "getLabel", "Tooltip"],
    docs: "/docs/guides/keyboard",
} satisfies ExampleMeta;
