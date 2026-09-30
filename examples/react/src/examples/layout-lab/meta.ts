import type { ExampleMeta } from "../meta-types";

export default {
    title: "Layout lab",
    description:
        "The model is the source of truth, made visible: edit the layout's JSON (v1) and load it, watch every command a middleware sees with its payload, veto one command, and undo or redo.",
    level: "advanced",
    order: 4,
    features: [
        "LayoutJson",
        "layout.load",
        "model.toJSON",
        "model.use",
        "veto",
        "model.commands",
        "UndoManager",
        "Switch",
        "Select",
    ],
    docs: "/docs/concepts/model-and-commands",
} satisfies ExampleMeta;
