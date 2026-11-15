import { typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        doc: { text: string };
        chart: { seed: number };
        kpi: { seed: number };
        table: undefined;
        log: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
