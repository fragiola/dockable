import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drop files",
    description:
        "Drag files from your computer into the layout: each becomes a tab where you drop it. Text files show their content, images are previewed, anything else shows its size and type.",
    level: "intermediate",
    order: 14,
    features: ["onExternalDrag", "DataTransfer", "Actions.addTab", "onDrop"],
    docs: "/docs/guides/external-drag",
} satisfies ExampleMeta;
