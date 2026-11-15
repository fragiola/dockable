import { typedDockable } from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        requests: undefined;
        latency: undefined;
        orders: undefined;
        refunds: undefined;
        events: undefined;
    };
    tabset: { name: string };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
