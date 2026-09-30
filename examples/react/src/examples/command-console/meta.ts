import type { ExampleMeta } from "../meta-types";

export default {
    title: "Command console",
    description:
        "Drive the layout by name plus JSON: list every command with its schema, run one through model.dispatch, read its result or its error, and see the commands as AI tool definitions.",
    level: "advanced",
    order: 8,
    features: [
        "model.commands",
        "model.dispatch",
        "model.subscribe",
        "JSON Schema",
        "AI tools",
    ],
    docs: "/docs/guides/ai-and-automation",
} satisfies ExampleMeta;
