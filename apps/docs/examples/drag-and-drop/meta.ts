import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drag and drop",
    description:
        "Drag tabs between tabsets and to the layout's edges. The drop indicator is styled per kind (into a tabset or at an edge) and side, animated with tabDragSpeed; the dragged tab and the layout dim through data-dragging, and edge indicators mark where a drop docks to an edge.",
    level: "intermediate",
    order: 8,
    features: [
        "DropIndicator",
        "data-drop-kind",
        "data-drop-location",
        "data-dragging",
        "tabDragSpeed",
        "EdgeIndicator",
    ],
    docs: "/docs/guides/drag-and-drop",
} satisfies ExampleMeta;
