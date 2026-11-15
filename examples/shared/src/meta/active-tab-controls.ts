import type { ExampleMeta } from "../meta-types";

export default {
    title: "Active tab controls",
    description:
        "A toolbar outside the layout drives the chart you are looking at: switch it between line, area, bar, pie and donut, or load new data. It follows the active tabset as you click around.",
    category: "external-integration",
    order: 3,
    features: [
        "default-tabset",
        "selected-tab-by",
        "tab.set-data",
        "typed data",
        "useModelState",
        "Chart",
    ],
    docs: "/docs/concepts/typed-data",
} satisfies ExampleMeta;
