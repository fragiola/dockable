import type { ExampleMeta } from "../meta-types";

export default {
    title: "Overflow to a select",
    description:
        "When the tabs no longer fit, only the ones that do not fit leave the strip, one by one as it narrows, into a Fragiola Select; the selected tab always stays. Picking a tab from the select brings it into the strip. The engine measures; the example renders the select.",
    level: "intermediate",
    order: 2,
    features: [
        "TabOverflowTrigger",
        "useTabOverflow",
        "data-overflow-hidden",
        "tab.select",
        "Select",
    ],
    docs: "/docs/guides/tab-overflow",
} satisfies ExampleMeta;
