import type { ExampleMeta } from "../meta-types";

export default {
    title: "Event toasts",
    description:
        "React to what happens in the layout: model.subscribe turns closes, moves, maximizes and adds into toasts, and a closed tab's toast offers Undo: the tab returns where the state before the close had it.",
    category: "model-api",
    order: 3,
    features: [
        "model.subscribe",
        "CommandEvent",
        "event.before",
        "toLayoutJson",
        "layout.load",
        "tab.close",
    ],
    docs: "/docs/api/command-bus",
} satisfies ExampleMeta;
