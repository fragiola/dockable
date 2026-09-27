import type { ExampleMeta } from "../meta-types";

export default {
    title: "Locked regions",
    description:
        "Stop drops into part of the layout: model.setOnAllowDrop refuses tabs that do not belong to a region, enableDrop, enableDrag and enableDivide lock a tabset, and onAction vetoes what gets through. Custom drop zones and feedback for refused drops are the Drop control Epic (#19).",
    level: "intermediate",
    order: 9,
    features: [
        "Model.setOnAllowDrop",
        "DropInfo",
        "enableDrop",
        "enableDrag",
        "enableDivide",
        "onAction",
        "Tooltip",
    ],
    docs: "/docs/guides/restricting-drops",
} satisfies ExampleMeta;
