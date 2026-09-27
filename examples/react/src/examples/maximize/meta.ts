import type { ExampleMeta } from "../meta-types";

export default {
    title: "Maximize",
    description:
        "Maximize a tabset with its header button or a double-click on the empty strip, restore it with Escape, and style it through data-maximized.",
    level: "intermediate",
    order: 5,
    features: ["Actions.maximizeToggle", "data-maximized", "keyboard"],
    docs: "/docs/guides/maximize",
} satisfies ExampleMeta;
