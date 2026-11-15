import { typedDockable } from "@fragiola/dockable-vue";
import type { ChartKind } from "../_kit/charts";

// The side panels serve a report: its outline, a search through it, bookmarks, notes and the
// alerts behind its figures.
export type Types = {
    tabs: {
        outline: { headings: string[] };
        search: { query: string; results: string[] };
        bookmarks: { pages: string[] };
        notes: { text: string };
        alerts: undefined;
        document: { summary: string; kind: ChartKind };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
