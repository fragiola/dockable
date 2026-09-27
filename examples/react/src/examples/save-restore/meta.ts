import type { ExampleMeta } from "../meta-types";

export default {
    title: "Save and restore",
    description:
        "Save the layout to localStorage, restore it, and reset to the default. The JSON is the layout: every tab, weight and selection.",
    level: "basic",
    order: 9,
    features: ["model.toJson", "Model.fromJson", "localStorage"],
    docs: "/docs/guides/persistence",
} satisfies ExampleMeta;
