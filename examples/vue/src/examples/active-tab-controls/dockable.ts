import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

export type ChartData = { kind: ChartKind; seed: number };

export type Types = {
    tabs: {
        chart: ChartData;
        table: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
