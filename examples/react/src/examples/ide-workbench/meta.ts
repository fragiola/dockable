import type { ExampleMeta } from "../meta-types";

export default {
    title: "IDE workbench",
    description:
        "A code editor: a file tree in a left border opens files as tabs, modified tabs show a dot and ask before closing, a terminal and problems panel in a bottom border, a context menu per tab, an overflow select, and the layout saved between visits.",
    level: "advanced",
    order: 1,
    features: [
        "Dockable.Borders",
        "typed data",
        "tab.add",
        "tab.select",
        "tab.update",
        "model.use veto",
        "model.subscribe",
        "toJSON",
        "LayoutValidationError",
        "AlertDialog",
        "ContextMenu",
        "Select",
        "localStorage",
    ],
    docs: "/docs/guides/tabs",
} satisfies ExampleMeta;
