import { typedDockable } from "@fragiola/dockable-vue";

// What both layouts hold: one tab component, named by its label. A transferred tab keeps its label,
// component and data, so the two models share the registry.
export type Types = { tabs: { card: undefined } };

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
