import type { ExampleMeta } from "../meta-types";

export default {
    title: "Multi-monitor",
    description:
        "A control room spread over several screens: send any tabset to its own window, drag panels between the windows, and bring them back. Every window follows the page's theme.",
    level: "advanced",
    order: 7,
    features: [
        "PopoutTrigger target=tabset",
        "drag between popouts",
        "popoutMirrorRoot",
        "engine.dockBack",
    ],
    docs: "/docs/guides/cross-layout-drag",
} satisfies ExampleMeta;
