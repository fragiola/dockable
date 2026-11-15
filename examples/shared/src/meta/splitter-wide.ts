import type { ExampleMeta } from "../meta-types";

export default {
    title: "Wide splitter",
    description:
        "A 12px splitter: the whole bar is a grab area, darker on hover, in the ring colour while dragged, with a live readout of its position. Its render prop reads the separator's aria-valuetext.",
    category: "splitters",
    order: 1,
    features: ["render prop", "aria-valuetext", "data-dragging"],
    docs: "/docs/guides/splitters",
} satisfies ExampleMeta;
