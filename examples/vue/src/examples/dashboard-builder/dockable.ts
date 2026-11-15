import { typedDockable } from "@fragiola/dockable-vue";
import type { WidgetComponent } from "./widgets";

/** What the layout holds: widget tabs have no data (the name is the tab's label); a tabset has a name. */
export type Types = {
    tabs: Record<WidgetComponent, undefined>;
    tabset: { name: string };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
