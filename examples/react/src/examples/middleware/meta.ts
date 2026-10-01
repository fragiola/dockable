import type { ExampleMeta } from "../meta-types";

export default {
    title: "Middleware",
    description:
        "Three app rules as middleware, each switched on and off at runtime: a veto that caps a tabset at four tabs (drags included), a rewrite that tidies tab names, and a log of every command.",
    category: "model-api",
    order: 2,
    features: ["model.use", "veto", "ctx.payload", "ctx.dryRun", "ctx.get"],
    docs: "/docs/api/command-bus",
} satisfies ExampleMeta;
