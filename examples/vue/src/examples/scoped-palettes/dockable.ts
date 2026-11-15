import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

export type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
        note: { text: string };
        log: undefined;
    };
    tabset: { palette: string };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
