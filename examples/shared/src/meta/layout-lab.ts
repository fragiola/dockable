import type { ExampleMeta } from "../meta-types";

export default {
    title: "Layout lab",
    description:
        "The model is the source of truth, made visible: edit the layout's JSON (v1) and load it, watch every command a middleware sees with its payload, veto one command, and undo or redo.",
    category: "model-api",
    order: 7,
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
    // a richer layout than its category's default frame
    height: 600,
} satisfies ExampleMeta;
