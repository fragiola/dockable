import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tab context menu",
    description:
        "A Fragiola ContextMenu on every tab: close, close others, close to the right, rename, pin, maximize and pop out. Each item is a command, disabled when model.can says it would be refused.",
    category: "tabs",
    order: 4,
    features: [
        "ContextMenu",
        "render prop",
        "model.can",
        "batch",
        "tab.close",
        "tab.update",
        "tab.pin",
        "tabset.maximize",
        "tab.popout",
    ],
    docs: "/docs/guides/menus",
} satisfies ExampleMeta;
