import type { ExampleMeta } from "../meta-types";

export default {
    title: "Component factory",
    description:
        "Each tab's component field selects its content (chart, table, markdown, form) and its typed data parameterises it. An Add menu creates any kind, and content mounts only when first shown.",
    level: "intermediate",
    order: 12,
    features: [
        "typed data",
        "TabNode",
        "renderOnDemand",
        "tab.add",
        "DropdownMenu",
        "Chart",
        "Table",
    ],
    docs: "/docs/concepts/typed-data",
} satisfies ExampleMeta;
