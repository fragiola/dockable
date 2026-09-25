import type { ExampleMeta } from "../meta-types";

export default {
    title: "Close tabs",
    description:
        "Close buttons on tabs, middle-click to close, a tab that cannot be closed, a close-tabset button, and a hint in an empty tabset.",
    level: "basic",
    order: 6,
    features: [
        "Actions.deleteTab",
        "Actions.deleteTabset",
        "enableClose",
        "data-empty",
    ],
    docs: "/docs/guides/tabs",
} satisfies ExampleMeta;
