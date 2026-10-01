import type { ExampleMeta } from "../meta-types";

export default {
    title: "Command console",
    description:
        "Drive the layout by name plus JSON: list every command with its schema, run one through model.dispatch, read its result or its error, and see the commands as AI tool definitions.",
    category: "model-api",
    order: 6,
    features: [
        "model.commands",
        "model.dispatch",
        "model.subscribe",
        "JSON Schema",
        "AI tools",
    ],
    docs: "/docs/guides/ai-and-automation",
    // a richer layout than its category's default frame
    height: 600,
} satisfies ExampleMeta;
