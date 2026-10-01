import type { ExampleMeta } from "../meta-types";

export default {
    title: "Undo and redo",
    description:
        "An UndoManager you own (the kit's `_kit/undo.ts`): undo and redo buttons, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, and the list of steps. A splitter drag is one step, and the content keeps its state across undo.",
    category: "model-api",
    order: 5,
    features: [
        "UndoManager",
        "model.subscribe",
        "layout.load",
        "useModelState",
        "useSyncExternalStore",
    ],
    docs: "/docs/guides/undo-redo",
} satisfies ExampleMeta;
