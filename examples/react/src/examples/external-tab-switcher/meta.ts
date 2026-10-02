import type { ExampleMeta } from "../meta-types";

export default {
    title: "External tab switcher",
    description:
        "Controls outside the layout pick the tab it shows and change that tab's counter. The count lives in the tab's typed data, so a click in a tab and a click outside stay in sync.",
    category: "external-integration",
    order: 2,
    features: [
        "tab.select",
        "tab.set-data",
        "selected-tab-by",
        "active-tabset",
        "model.subscribe",
        "typed data",
    ],
    docs: "/docs/guides/tabs",
} satisfies ExampleMeta;
