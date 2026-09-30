import type { ExampleMeta } from "../meta-types";

export default {
    title: "Ops monitor",
    description:
        "A live operations console: simulated metrics stream in, service tabs are coloured and badged by their alert level, the overview tab is pinned, the incident region is locked, and the keyboard moves between tabsets.",
    level: "advanced",
    order: 3,
    features: [
        "typed data",
        "tab.update",
        "data-status",
        "pinned",
        "model.use",
        "keyMap",
        "renderOnDemand",
        "Chart",
        "Tooltip",
    ],
    docs: "/docs/guides/status-aware-tabs",
} satisfies ExampleMeta;
