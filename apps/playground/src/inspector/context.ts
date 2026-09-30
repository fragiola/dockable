import type { Model } from "@fragiola/dockable";
import { createContext, useContext, useEffect } from "react";

// How a scenario turns the Inspector on: one call with its model. The shell owns the panel; the
// scenario only says which model to watch, and stops when it unmounts. App code, never part of a
// package (AGENTS.md rule 12). Examples do not call it: they render as the site shows them.

export type InspectorRegistry = {
    /** Watches `model`; returns the function that stops watching it. */
    register: (model: Model) => () => void;
};

export const InspectorContext = createContext<InspectorRegistry | null>(null);

/**
 * Shows `model` in the playground's Inspector: the actions it applies, its JSON, and the layout's
 * `data-*`/ARIA state. Outside the playground (no shell around it) it does nothing.
 */
export function useInspector(model: Model) {
    const registry = useContext(InspectorContext);
    useEffect(() => registry?.register(model), [registry, model]);
}
