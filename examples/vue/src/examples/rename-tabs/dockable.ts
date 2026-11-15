import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

// The chart's title and the KPI's caption are the tab's label: a rename shows in the content too.
export type Types = {
    tabs: {
        note: { text: string };
        chart: { kind: ChartKind; seed: number };
        kpi: { seed: number };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
