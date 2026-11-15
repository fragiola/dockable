import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

export type Types = {
    tabs: {
        table: undefined;
        chart: { kind: ChartKind; seed: number };
        log: undefined;
        kpi: { seed: number };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();

export type Position = "top" | "bottom";
