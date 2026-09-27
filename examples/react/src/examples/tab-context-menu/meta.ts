import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tab context menu",
    description:
        "A Fragiola ContextMenu on every tab: close, close others, close to the right, rename, pin, maximize and pop out. Unavailable items are disabled from the model's own flags.",
    level: "intermediate",
    order: 3,
    features: [
        "ContextMenu",
        "render prop",
        "Actions.deleteTab",
        "Actions.renameTab",
        "Actions.setTabPinned",
        "Actions.maximizeToggle",
        "Actions.popoutTab",
    ],
    docs: "/docs/guides/menus",
} satisfies ExampleMeta;
