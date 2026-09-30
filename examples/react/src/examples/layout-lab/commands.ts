import type { CommandName, LayoutJson } from "@fragiola/dockable";

// The lab's registry and starting layout, and the log of the commands its middleware sees.

/** What the layout holds: one tab component, named in its data. */
export type Types = { tabs: { card: { name: string } } };

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
                        data: { name: "Welcome" },
                    },
                    { id: "notes", component: "card", data: { name: "Notes" } },
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
                                component: "card",
                                data: { name: "Inspector" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "bottom",
                        children: [
                            {
                                id: "console",
                                component: "card",
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
