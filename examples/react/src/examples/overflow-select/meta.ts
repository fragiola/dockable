import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tab overflow: select or scroll",
    description:
        "The editor's tabs that do not fit go to a Fragiola Select; the selected one stays. The tools' strip keeps every tab and scrolls the selected one into view.",
    category: "tabs",
    order: 5,
    features: [
        "TabOverflowTrigger",
        "useTabOverflow",
        "data-overflow-hidden",
        "overflow={false}",
        "useModelState",
        "tab.select",
        "Select",
    ],
    docs: "/docs/guides/tab-overflow",
} satisfies ExampleMeta;
