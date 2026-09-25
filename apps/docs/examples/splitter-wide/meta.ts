import type { ExampleMeta } from "../meta-types";

export default {
    title: "Wide splitter",
    description:
        "A 12px splitter with a centred grip, hover and active states, and a live readout of its aria-valuenow, built on the useSplitter hook.",
    level: "basic",
    order: 4,
    features: ["useSplitter", "aria-valuenow", "data-dragging", "grip"],
    docs: "/docs/guides/splitters",
} satisfies ExampleMeta;
