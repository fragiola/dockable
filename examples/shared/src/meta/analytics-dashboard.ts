import type { ExampleMeta } from "../meta-types";

export default {
    title: "Analytics dashboard",
    description:
        "Charts, KPIs and a table under shared filters: add widgets from a menu, a KPI tab turns red below its target, maximize a chart or pop it out to a second screen, and undo or redo any layout change.",
    category: "apps",
    order: 3,
    features: [
        "component factory",
        "typed data",
        "tab.add",
        "tab.set-data",
        "tabset.maximize",
        "PopoutTrigger",
        "UndoManager",
        "Chart",
        "Table",
        "DropdownMenu",
    ],
    docs: "/docs/guides/popouts",
} satisfies ExampleMeta;
