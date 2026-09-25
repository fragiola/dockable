import type { ExampleMeta } from "../meta-types";

export default {
    title: "Undo and redo",
    description:
        "The core's UndoManager: undo and redo buttons, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, and the list of steps. A splitter drag is one step, and the content keeps its state across undo.",
    level: "intermediate",
    order: 7,
    features: ["UndoManager", "useSyncExternalStore", "onModelChange"],
    docs: "/docs/guides/undo-redo",
} satisfies ExampleMeta;
