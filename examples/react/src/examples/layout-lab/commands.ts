import type { CommandName, LayoutJson } from "@fragiola/dockable";
import type { ChartKind } from "../_kit/charts";

// The lab's registry and starting layout, and the log of the commands its middleware sees.

/**
 * What the layout holds: a card of text, a chart of a kind and a log, each named in its data.
 * Edit a tab's `component` or `data` in the JSON and Apply: the panel follows.
 */
export type Types = {
    tabs: {
        card: { name: string; text?: string };
        chart: { name: string; kind: ChartKind };
        log: { name: string };
    };
};

export const initialLayout: LayoutJson<Types> = {
    version: 1,
    root: {
        // explicit ids keep the JSON readable (the model generates one for any node without)
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "primary",
                weight: 55,
                children: [
                    {
                        id: "welcome",
                        component: "card",
                        data: {
                            name: "Welcome",
                            text: "This layout is the JSON on the left: edit a tab's name, component or data and Apply.",
                        },
                    },
                    {
                        id: "notes",
                        component: "card",
                        data: {
                            name: "Notes",
                            text: "Undo and redo load the previous layout back into the same model.",
                        },
                    },
                ],
            },
            {
                type: "row",
                id: "side",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        id: "top",
                        children: [
                            {
                                id: "inspector",
                                component: "chart",
                                data: { name: "Inspector", kind: "bar" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "bottom",
                        children: [
                            {
                                id: "console",
                                component: "log",
                                data: { name: "Console" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export interface LogEntry {
    id: number;
    command: CommandName;
    payload: string;
    /** "applied", or why not: "vetoed", "refused", "not_found", … (the result's error code) */
    outcome: string;
    /** a step of a gesture still in progress (a splitter drag) */
    transient: boolean;
}

let nextId = 0;

/** Adds a command to the log. A drag (a stream of transient commands) is one line. */
export function appendToLog(
    log: LogEntry[],
    command: CommandName,
    payload: unknown,
    outcome: string,
    transient: boolean,
): LogEntry[] {
    const entry: LogEntry = {
        id: ++nextId,
        command,
        payload: JSON.stringify(payload),
        outcome,
        transient,
    };
    const last = log[log.length - 1];
    if (last?.transient && last.command === command) {
        return [...log.slice(0, -1), entry];
    }
    return [...log, entry].slice(-100);
}
