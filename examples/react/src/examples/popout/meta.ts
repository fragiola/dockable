import type { ExampleMeta } from "../meta-types";

export default {
    title: "Pop out",
    description:
        "Pop a tab out into its own themed window and dock it back: the content keeps its state both ways, and closing the window docks its tabs back into the layout.",
    category: "popouts",
    order: 1,
    features: [
        "Dockable.Popout",
        "Dockable.PopoutTrigger",
        "tab.popout",
        "popoutURL",
        "defaults.tab.poppable",
    ],
    docs: "/docs/guides/popouts",
} satisfies ExampleMeta;
