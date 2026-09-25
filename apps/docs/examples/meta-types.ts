// The shape of an example's meta.ts. Site-internal: examples never import this
// from their code, only their meta.ts does.

export const LEVELS = ["basic", "intermediate", "advanced"] as const;

export type Level = (typeof LEVELS)[number];

export const LEVEL_TITLES: Record<Level, string> = {
    basic: "Basic",
    intermediate: "Intermediate",
    advanced: "Advanced",
};

export interface ExampleMeta {
    /** the example's name in the sidebar and the page title */
    title: string;
    /** one or two sentences: what it shows */
    description: string;
    level: Level;
    /** position inside its level, ascending */
    order: number;
    /** the APIs and techniques it shows, as short tags */
    features: string[];
    /** the docs page it belongs to, e.g. "/docs/guides/splitters" */
    docs?: string;
}
