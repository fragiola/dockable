import type { ExampleMeta } from "../meta-types";

export default {
    title: "Layout lab",
    description:
        "The model is the source of truth, made visible: edit the layout's JSON and apply it, watch every action onAction receives with its payload, veto one action type, and undo or redo.",
    level: "advanced",
    order: 4,
    features: [
        "IJsonModel",
        "Model.fromJson",
        "model.toJson",
        "onAction",
        "Actions.*",
        "UndoManager",
        "Switch",
        "Select",
    ],
    docs: "/docs/concepts/model-and-actions",
} satisfies ExampleMeta;
