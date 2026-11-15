import type { ExampleMeta } from "../meta-types";

export default {
    title: "Remote control",
    description:
        "Drive tabs and tabsets from code: select, move, dock, maximize, add and close from a panel beside the layout. Each button asks model.check first, so a refused command is disabled and says why.",
    category: "model-api",
    order: 1,
    features: [
        "model.run",
        "model.check",
        "tab.select",
        "tab.move",
        "tabset.maximize",
        "tabset.activate",
        "tab.add",
        "tabset.close",
    ],
    docs: "/docs/api/command-bus",
} satisfies ExampleMeta;
