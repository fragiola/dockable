import type { ExampleMeta } from "../meta-types";

export default {
    title: "Two layouts",
    description:
        "Two independent layouts (two models) exchange tabs by drag and drop, and the content keeps its state. Undo and redo are the app's: a history built on the transfer events, where undoing a move brings the tab back to where it came from.",
    level: "advanced",
    order: 6,
    features: [
        "Dockable.DragGroup",
        "onTransfer",
        "group.transfer",
        "app-built undo",
    ],
    docs: "/docs/guides/cross-layout-drag",
} satisfies ExampleMeta;
