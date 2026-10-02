import type { ExampleMeta } from "../meta-types";

export default {
    title: "Right-to-left layout",
    description:
        "A layout in a right-to-left page: start is on the right, so the start border, the first tabset and the first tab are there. Splitters, arrow keys and drops follow the screen; flip the direction and the panels follow too.",
    category: "styling",
    order: 2,
    features: [
        'dir="rtl"',
        "runtime dir flip",
        "start / end",
        "tabDirection",
        "EdgeIndicator",
    ],
    docs: "/docs/guides/rtl",
} satisfies ExampleMeta;
