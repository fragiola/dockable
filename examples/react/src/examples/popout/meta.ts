import type { ExampleMeta } from "../meta-types";

export default {
    title: "Pop out",
    description:
        "Pop a tab out into its own themed window and dock it back: the content keeps its state both ways, and closing the window docks its tabs back into the layout.",
    level: "intermediate",
    order: 10,
    features: [
        "Dockable.Popout",
        "Actions.popoutTab",
        "popoutURL",
        "enablePopout",
    ],
    docs: "/docs/guides/popouts",
} satisfies ExampleMeta;
