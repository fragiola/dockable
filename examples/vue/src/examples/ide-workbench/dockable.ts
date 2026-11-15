import { typedDockable } from "@fragiola/dockable-vue";
import type { EditorData } from "./workspace";

export type Types = {
    tabs: {
        editor: EditorData;
        explorer: undefined;
        terminal: undefined;
        problems: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
