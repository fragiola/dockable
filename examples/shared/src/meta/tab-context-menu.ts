import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tab context menu",
    description:
        "A Fragiola ContextMenu on every tab: close, close others, close to the right, pin and maximize. Each item is a command, disabled when model.can says it would be refused.",
    category: "tabs",
    order: 4,
    features: [
        "ContextMenu",
        "render prop",
        "model.can",
        "batch",
        "tab.close",
        "tab.pin",
        "tabset.maximize",
    ],
    docs: "/docs/guides/menus",
} satisfies ExampleMeta;
