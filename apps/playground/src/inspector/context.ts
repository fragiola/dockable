import type { CommandEvent } from "@fragiola/dockable-react";
import { createContext, useContext, useEffect } from "react";

// How a scenario turns the Inspector on: one call with its model. The shell owns the panel; the
// scenario only says which model to watch, and stops when it unmounts. App code, never part of a
// package (AGENTS.md rule 12). Examples do not call it: they render as the site shows them.

/** What the Inspector logs of a commit: the fields that do not depend on the model's registry. */
export type InspectedEvent = Pick<
    CommandEvent,
    "command" | "payload" | "result" | "transient" | "commands"
>;

/**
 * What the Inspector reads of a model. Any `Model<T>` is one, whatever its registry `T` (a
 * `Model<T>` is not a `Model<AnyTypes>`: node types are invariant in `T`).
 */
export interface InspectedModel {
    subscribe(listener: (event: InspectedEvent) => void): () => void;
    get(key: "layout-json"): unknown;
}

export type InspectorRegistry = {
    /** Watches `model`; returns the function that stops watching it. */
    register: (model: InspectedModel) => () => void;
};

export const InspectorContext = createContext<InspectorRegistry | null>(null);

/**
 * Shows `model` in the playground's Inspector: the commands it runs, its JSON, and the layout's
 * `data-*`/ARIA state. Outside the playground (no shell around it) it does nothing.
 */
export function useInspector(model: InspectedModel) {
    const registry = useContext(InspectorContext);
    useEffect(() => registry?.register(model), [registry, model]);
}
