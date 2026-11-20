import { typedDockable } from "@fragiola/dockable-vue";
import type { Types } from "./workspace";

export type { Types };

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
