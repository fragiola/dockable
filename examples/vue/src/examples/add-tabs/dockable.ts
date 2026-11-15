import { typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        chart: undefined;
        table: undefined;
        log: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
