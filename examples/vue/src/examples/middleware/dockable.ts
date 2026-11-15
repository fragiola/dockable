import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

export type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
        log: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();

/** A line of the Log tab, written by the observing middleware (index.vue). */
export interface LogEntry {
    id: number;
    command: string;
    outcome: string;
    ok: boolean;
}
