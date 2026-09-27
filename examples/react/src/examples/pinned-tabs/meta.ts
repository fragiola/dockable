import type { ExampleMeta } from "../meta-types";

export default {
    title: "Pinned tabs",
    description:
        "Pinned tabs stay at the start of the strip as icons and cannot be closed. The pin button in the header toggles the selected tab; the styles read data-pinned.",
    level: "intermediate",
    order: 6,
    features: ["Actions.setTabPinned", "data-pinned", "isCloseable"],
    docs: "/docs/guides/tabs",
} satisfies ExampleMeta;
