import { typedDockable } from "@fragiola/dockable-vue";
import { CircleCheck, CircleX, TriangleAlert } from "@lucide/vue";

export type Status = "healthy" | "degraded" | "down";

export interface MonitorData {
    status: Status;
    incidents: number;
}

export interface DocumentData {
    dirty: boolean;
}

export type Types = { tabs: { monitor: MonitorData; document: DocumentData } };

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();

export const STATUS = {
    healthy: { Icon: CircleCheck, text: "Healthy" },
    degraded: { Icon: TriangleAlert, text: "Degraded" },
    down: { Icon: CircleX, text: "Down" },
} as const;
