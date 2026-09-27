import type { ExampleMeta } from "../meta-types";

export default {
    title: "Widget sidebar",
    description:
        "A sidebar of widgets outside the layout: drag a chart, a table or a log into any tabset, onto a tabset edge or to the layout edge. Click a widget to add it to the active tabset from the keyboard.",
    level: "intermediate",
    order: 13,
    features: [
        "Dockable.DragSource",
        "Actions.addTab",
        "LayoutEngine.of",
        "data-dragging",
    ],
    docs: "/docs/guides/external-drag",
} satisfies ExampleMeta;
