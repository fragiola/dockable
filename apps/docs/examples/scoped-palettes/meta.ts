import type { ExampleMeta } from "../meta-types";

export default {
    title: "Scoped palettes",
    description:
        "Fragiola palettes scoped per tabset: a DropdownMenu in each header picks blue, orange, green, purple, surface or raised, saved in the tabset's config. The tabset and its panels take the palette's six roles.",
    level: "intermediate",
    order: 11,
    features: [
        "Fragiola palettes",
        "DropdownMenu",
        "TabSet className",
        "Actions.updateNodeAttributes",
    ],
    docs: "/docs/guides/theming",
} satisfies ExampleMeta;
