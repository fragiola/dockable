import { typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        chart: { kind: "line" | "bar" | "area" | "donut" };
        table: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
