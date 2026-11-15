import { type Model, typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        chart: undefined;
        bars: undefined;
        table: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();

/** Maximizes the tabset, or restores the layout when it is the maximized one. */
export function toggleMaximize(model: Model<Types>, tabsetId: string) {
    model.run("tabset.maximize", {
        tabsetId,
        value: !model.is("tabset-maximized", { tabsetId }),
    });
}
