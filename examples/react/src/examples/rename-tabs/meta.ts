import type { ExampleMeta } from "../meta-types";

export default {
    title: "Rename tabs",
    description:
        "Double-click a tab (or press F2) to rename it inline: Enter confirms, Escape cancels, and an empty name is refused.",
    category: "tabs",
    order: 2,
    features: ["tab.configure", "tab label", "Tab onDoubleClick"],
    docs: "/docs/guides/tabs",
} satisfies ExampleMeta;
