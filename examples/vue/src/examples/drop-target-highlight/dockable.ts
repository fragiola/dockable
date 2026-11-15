import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

// What the layout holds: one component per kind of content, each named by its label.
export type Types = {
    tabs: {
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number; unit?: string };
        table: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
