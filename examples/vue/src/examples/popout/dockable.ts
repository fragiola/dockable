import { typedDockable } from "@fragiola/dockable-vue";

// What the layout holds: each tab component and the type of its data.
export type Types = { tabs: { card: undefined } };

// The primitives typed by Types (a template cannot pass a type argument): `tab` in a slot is a
// tab of this layout, and `tab.data` narrows on `tab.component`.
export const Dockable = typedDockable<Types>();
