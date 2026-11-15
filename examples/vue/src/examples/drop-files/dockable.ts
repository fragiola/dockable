import { typedDockable } from "@fragiola/dockable-vue";
import type { Csv } from "./files";

export type Types = {
    tabs: {
        welcome: undefined;
        pending: undefined;
        table: { csv: Csv };
        chart: { csv: Csv };
        image: undefined;
        info: { type: string; size: number };
        error: { message: string };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
