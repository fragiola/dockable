import { typedDockable } from "@fragiola/dockable-vue";

// What the layout holds: an editor's tabs, each named by its label. A file and a tool's output
// carry their text, the terminal is a log, and Problems lists what is wrong where. A tabset's
// `overflow` picks how its strip overflows; a tabset without it (one a drop creates) uses the
// select.
export type Types = {
    tabs: {
        file: { text: string };
        output: { text: string };
        terminal: undefined;
        problems: { items: { where: string; message: string }[] };
    };
    tabset: { overflow: "select" | "scroll" };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
