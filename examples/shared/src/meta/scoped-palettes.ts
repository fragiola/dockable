import type { ExampleMeta } from "../meta-types";

export default {
    title: "Scoped palettes",
    description:
        "Give each tabset its own colour scheme. A dropdown in the tabset header picks a palette (blue, orange, green, purple, surface or raised), stored in the tabset's data through the tabset.configure command, so it is saved with the layout. A palette is just a CSS class that sets a few colour variables (background, soft fill, line, text, accent and focus ring); the tabs and panels inside the tabset read them.",
    category: "styling",
    order: 1,
    features: [
        "Fragiola palettes",
        "DropdownMenu",
        "TabSet className",
        "tabset.configure",
        "typed data",
    ],
    docs: "/docs/guides/theming",
} satisfies ExampleMeta;
