import { typedDockable } from "@fragiola/dockable-vue";
import type { Types } from "./data";

// The dashboard's registry (each widget's `component` and its tab's `data`) is declared in data.ts,
// beside the widget catalogue and the layout that use it.
export type { Types };

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
