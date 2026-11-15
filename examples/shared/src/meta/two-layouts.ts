import type { ExampleMeta } from "../meta-types";

export default {
    title: "Two layouts",
    description:
        "Two independent layouts (two models) exchange tabs by drag and drop, inside one DragGroup, and the content keeps its state.",
    category: "apps",
    order: 6,
    features: ["Dockable.DragGroup", "tab.add", "tab.close", "meta.transfer"],
    docs: "/docs/guides/cross-layout-drag",
} satisfies ExampleMeta;
