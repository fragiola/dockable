import type { ExampleMeta } from "../meta-types";

export default {
    title: "Hello layout",
    description:
        "The smallest themed layout: two tabsets side by side, splitters, and panels whose content survives every move.",
    level: "basic",
    order: 1,
    features: ["Root", "Row", "TabSet", "Panels", "Model.fromJson"],
    docs: "/docs/getting-started/first-layout",
} satisfies ExampleMeta;
