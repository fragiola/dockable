import type { ExampleMeta } from "../meta-types";

export default {
    title: "Content-aware tabs",
    description:
        "The tab follows its content: service monitors turn their tab green, orange or red, and an editor marks its tab as modified. The content writes into the tab's config; the tab reads it into data-* attributes.",
    level: "intermediate",
    order: 1,
    features: [
        "Actions.updateNodeAttributes",
        "TabNode.getConfig",
        "data-status",
        "Badge",
    ],
    docs: "/docs/guides/status-aware-tabs",
} satisfies ExampleMeta;
