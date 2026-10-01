import type { ExampleMeta } from "../meta-types";

export default {
    title: "Dashboard builder",
    description:
        "Build a dashboard by dragging widgets from a palette: KPIs only go in the KPI strip, charts and tables anywhere else, and the layout is saved between visits.",
    category: "apps",
    order: 2,
    features: [
        "Dockable.DragSource",
        "model.use",
        "tab.add",
        "data-empty",
        "toJSON",
        "createModel",
        "layout.load",
    ],
    docs: "/docs/guides/external-drag",
} satisfies ExampleMeta;
