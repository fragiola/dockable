import type { ExampleMeta } from "../meta-types";

export default {
    title: "Multi-monitor",
    description:
        "A control room spread over several screens: send any tabset to its own window, drag panels between the windows, and bring them back. Every window follows the page's theme.",
    category: "popouts",
    order: 3,
    features: [
        "PopoutTrigger target=tabset",
        "drag between popouts",
        "popoutMirrorRoot",
        "window.close",
        "batch",
        "typed data",
    ],
    docs: "/docs/guides/cross-layout-drag",
    // a richer layout than its category's default frame
    height: 600,
} satisfies ExampleMeta;
