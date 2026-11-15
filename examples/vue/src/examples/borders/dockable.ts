import { typedDockable } from "@fragiola/dockable-vue";

// The tab's name is its label; only the editor has data of its own.
export type Types = {
    tabs: {
        explorer: undefined;
        search: undefined;
        terminal: undefined;
        outline: undefined;
        editor: { source: string };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
