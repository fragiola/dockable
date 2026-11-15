import { typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        doc: { region: string };
        console: undefined;
    };
    tabset: { name: string };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
