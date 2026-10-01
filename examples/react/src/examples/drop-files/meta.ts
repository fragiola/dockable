import type { ExampleMeta } from "../meta-types";

export default {
    title: "Open files from your desktop",
    description:
        "Drop files from your computer where you want them to open: a CSV becomes a table and a chart, an image a viewer, and a saved layout replaces this one. Sample files work without any at hand.",
    category: "external-integration",
    order: 5,
    features: [
        "onExternalDrag",
        "DataTransfer",
        "tab.update",
        "tab.add",
        "model.dispatch",
        "layout.load",
    ],
    docs: "/docs/guides/external-drag",
} satisfies ExampleMeta;
