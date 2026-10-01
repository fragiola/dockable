import type { ExampleMeta } from "../meta-types";

export default {
    title: "Border tab orientation",
    description:
        "How a side border's tabs read is styling, not the package: the same left and right borders with their labels turned vertical (the example's default, with writing-mode) or upright in a column. The toggle only swaps class names; Dockable.Border sets nothing but structural flex.",
    level: "intermediate",
    order: 20,
    features: [
        "Dockable.Border",
        "data-orientation",
        "data-tab-direction",
        "writing-mode",
    ],
    docs: "/docs/guides/borders",
} satisfies ExampleMeta;
