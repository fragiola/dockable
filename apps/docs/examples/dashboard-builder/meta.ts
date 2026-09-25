import type { ExampleMeta } from "../meta-types";

export default {
    title: "Dashboard builder",
    description:
        "Build a dashboard by dragging widgets from a palette: KPIs only go in the KPI strip, charts and tables anywhere else, and the layout is saved between visits.",
    level: "advanced",
    order: 5,
    features: [
        "Dockable.DragSource",
        "setOnAllowDrop",
        "Actions.addTab",
        "data-empty",
        "toJson",
    ],
    docs: "/docs/guides/external-drag",
} satisfies ExampleMeta;
