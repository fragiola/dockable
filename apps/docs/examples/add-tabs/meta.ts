import type { ExampleMeta } from "../meta-types";

export default {
    title: "Add tabs",
    description:
        "A toolbar outside the layout adds chart, table and log tabs to the active tabset, or to a new tabset docked to the right or bottom.",
    level: "basic",
    order: 5,
    features: ["Actions.addTab", "DockLocation", "getActiveTabset", "Select"],
    docs: "/docs/guides/tabs",
} satisfies ExampleMeta;
