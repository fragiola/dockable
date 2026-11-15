import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

// Every component carries the icon its tab shows when pinned.
type TabData = { icon?: string };
export type Types = {
    tabs: {
        chart: TabData & { kind: ChartKind; seed: number };
        kpi: TabData & { seed: number; unit?: string };
        table: TabData;
        doc: TabData & { text: string };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
