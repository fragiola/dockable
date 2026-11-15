import { typedDockable } from "@fragiola/dockable-vue";
import type { Level, ServiceId } from "./simulation";

/** What a service tab keeps in its `data`; `status` and `alerts` are written by its panel. */
export interface ServiceData {
    service: ServiceId;
    status?: Level;
    alerts?: number;
}

export type Types = {
    tabs: {
        overview: undefined;
        service: ServiceData;
        events: undefined;
        runbook: undefined;
        timeline: undefined;
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
