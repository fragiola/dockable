import { typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        table: undefined;
        note: { text: string };
        chart: { seed: number };
        kpi: { seed: number };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
