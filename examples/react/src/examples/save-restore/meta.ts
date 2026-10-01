import type { ExampleMeta } from "../meta-types";

export default {
    title: "Save and restore",
    description:
        "Save the layout to localStorage, restore it (validated, with the problems shown when the stored JSON is invalid), and reset to the default. The JSON is the layout: every tab, weight and selection.",
    category: "model-api",
    order: 4,
    features: [
        "model.toJSON",
        "layout.load",
        "model.dispatch",
        "JSON v1",
        "localStorage",
    ],
    docs: "/docs/guides/persistence",
} satisfies ExampleMeta;
