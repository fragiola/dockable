import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drop zones",
    description:
        "Zones outside the layout that take a dragged tab: a trash can that closes it, a pad that opens it to the right, and one that pops it out into a window.",
    level: "intermediate",
    order: 15,
    features: [
        "Dockable.DropZone",
        "data-drop-active",
        "data-drop-over",
        "Actions.deleteTab",
    ],
    docs: "/docs/guides/drop-zones",
} satisfies ExampleMeta;
