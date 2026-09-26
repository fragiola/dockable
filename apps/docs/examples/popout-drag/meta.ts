import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drag between windows",
    description:
        "Pop a tab (or a whole tabset) out into a window, then drag tabs between the window and the main layout, both ways. The content keeps its state, and the window shows its own drop outline.",
    level: "intermediate",
    order: 17,
    features: [
        "Dockable.PopoutTrigger",
        "cross-window drag",
        "popoutMirrorRoot",
        "Dockable.Popout",
    ],
    docs: "/docs/guides/cross-layout-drag",
} satisfies ExampleMeta;
