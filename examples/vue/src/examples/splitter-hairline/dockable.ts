import { typedDockable } from "@fragiola/dockable-vue";

// An editor's panes: a file tree, two source files and a terminal.
export type Types = {
    tabs: {
        files: { files: string[] };
        source: { code: string };
        terminal: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
