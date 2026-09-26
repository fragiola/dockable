import type { ExampleMeta } from "../meta-types";

export default {
    title: "Overlay borders",
    description:
        "Borders whose panels slide over the layout instead of shrinking it, and close on a click elsewhere or Escape. Switch each border between split and overlay; an empty auto-hide border on the right appears while a tab is dragged near that edge.",
    level: "intermediate",
    order: 19,
    features: [
        "borderType: overlay",
        "Actions.setBorderType",
        "enableAutoHide",
        "EdgeIndicator",
        "closeOverlayBorder",
    ],
    docs: "/docs/guides/borders",
} satisfies ExampleMeta;
