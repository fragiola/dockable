import { type TabOf, typedDockable } from "@fragiola/dockable-vue";

export type Types = { tabs: { counter: { count: number } } };

export type CounterTab = TabOf<Types>;

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
