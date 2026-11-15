import { typedDockable } from "@fragiola/dockable-vue";
import type { Types } from "./commands";

// The registry lives with the lab's starting layout, in commands.ts.
export type { Types };

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
