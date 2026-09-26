import type { ExampleMeta } from "../meta-types";

export default {
    title: "Focused tab",
    description:
        "The focused tab, the selected tab of the active tabset, at full opacity with a frame in the ring colour; every other tab faded to half. Click another tabset and the focus moves; keyboard focus shows as a dashed frame.",
    level: "basic",
    order: 7,
    features: [
        "data-active",
        "data-selected",
        "in-data-active",
        "focus-visible",
    ],
    docs: "/docs/guides/styling-tailwind",
} satisfies ExampleMeta;
