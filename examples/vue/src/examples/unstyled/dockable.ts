import { typedDockable } from "@fragiola/dockable-vue";

export type Types = { tabs: { card: undefined } };

// The primitives typed by Types (a template cannot pass a type argument).
export const Dockable = typedDockable<Types>();
