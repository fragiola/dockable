import type { DockableTypes, Model } from "@fragiola/dockable-vue";
import { onUnmounted, type Ref, shallowRef } from "vue";

// What the console's views share: the sample commands it offers and the log of every commit.

export const SAMPLES = [
    {
        label: "Select",
        input: { command: "tab.select", payload: { tabId: "todo" } },
    },
    {
        label: "Move",
        input: { command: "tab.move", payload: { tabId: "ideas", to: "left" } },
    },
    {
        label: "Add",
        input: {
            command: "tab.add",
            payload: {
                component: "note",
                label: "Draft",
                data: { text: "Added from JSON." },
                to: "left",
            },
        },
    },
    {
        label: "Invalid",
        input: { command: "tab.move", payload: { tabId: 3 } },
    },
] as const;

export interface LogEntry {
    id: number;
    command: string;
    payload: string;
    transient: boolean;
}

/** Every commit, newest first: a gesture's transient steps and its last command are one line. */
export function useCommandLog<T extends DockableTypes>(
    model: Model<T>,
): Readonly<Ref<readonly LogEntry[]>> {
    const log = shallowRef<readonly LogEntry[]>([]);
    let next = 0;
    const unsubscribe = model.subscribe((event) => {
        const entries = log.value;
        const entry: LogEntry = {
            id: next++,
            command: event.command,
            payload: JSON.stringify(event.payload),
            transient: event.transient,
        };
        const [latest, ...rest] = entries;
        // a drag's steps (and the command that ends it) replace its line
        log.value =
            latest?.transient && latest.command === entry.command
                ? [entry, ...rest]
                : [entry, ...entries].slice(0, 20);
    });
    onUnmounted(unsubscribe);
    return log;
}
