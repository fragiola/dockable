// The shape of an example's meta.ts. Site-internal: examples never import this
// from their code, only their meta.ts does. The fields map onto an entry of the
// site export's manifest.json (scripts/manifest.ts).

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
    /**
     * How the site sizes its frame. `"fill"` (the default, every Dockable layout): the example
     * fills a frame of `height`. `"flow"`: the frame grows with the content, `height` is its floor.
     */
    layout?: ExampleLayout;
    /** the frame height in pixels (default: {@link DEFAULT_HEIGHT} for its level) */
    height?: number;
}

export const LAYOUTS = ["fill", "flow"] as const;

export type ExampleLayout = (typeof LAYOUTS)[number];

/** The frame height of an example that names none: the richer the level, the taller. */
export const DEFAULT_HEIGHT: Record<Level, number> = {
    basic: 420,
    intermediate: 480,
    advanced: 600,
};
