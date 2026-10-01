import type { ExampleMeta } from "../meta-types";

export default {
    title: "Framed handle",
    description:
        "A 1px line with a framed pill handle on it: border, shadow and grip lines, wider than the splitter it sits on, restyled on hover, drag and keyboard focus.",
    category: "splitters",
    order: 4,
    features: [
        "Dockable.Splitter",
        "::before",
        "data-dragging",
        "focus-visible",
    ],
    docs: "/docs/guides/splitters",
} satisfies ExampleMeta;
