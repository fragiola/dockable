// The shape of an example's meta.ts. Site-internal: examples never import this
// from their code, only their meta.ts does. The fields map onto an entry of the
// site export's manifest.json (scripts/manifest.ts).
//
// The gallery groups examples by category: the feature they show. The site export contract (v1.2)
// calls a category a `level`: `examples.json` lists CATEGORIES as its `levels`, and each manifest
// entry's `level` is its category's id (scripts/manifest.ts, site/sources.ts).

/** The gallery's groups, in the order the sidebar lists them. */
export const CATEGORIES = [
    "getting-started",
    "tabs",
    "splitters",
    "drag-and-drop",
    "borders",
    "popouts",
    "styling",
    "model-api",
    "external-integration",
    "apps",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TITLES: Record<Category, string> = {
    "getting-started": "Getting started",
    tabs: "Tabs",
    splitters: "Splitters",
    "drag-and-drop": "Drag and drop",
    borders: "Borders",
    popouts: "Popouts",
    styling: "Styling",
    "model-api": "Model API",
    "external-integration": "External integration",
    apps: "Apps",
};

export interface ExampleMeta {
    /** the example's name in the sidebar and the page title */
    title: string;
    /** one or two sentences: what it shows */
    description: string;
    /** the feature it shows: its group in the gallery */
    category: Category;
    /** position inside its category, ascending */
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
    /** the frame height in pixels (default: {@link DEFAULT_HEIGHT} for its category) */
    height?: number;
}

export const LAYOUTS = ["fill", "flow"] as const;

export type ExampleLayout = (typeof LAYOUTS)[number];

/** The frame height of an example that names none: a first layout is small, an app is tall. */
export const DEFAULT_HEIGHT: Record<Category, number> = {
    "getting-started": 420,
    tabs: 480,
    splitters: 480,
    "drag-and-drop": 480,
    borders: 480,
    popouts: 480,
    styling: 480,
    "model-api": 480,
    "external-integration": 480,
    apps: 600,
};
