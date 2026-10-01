import type { ComponentType } from "react";
import {
    CATEGORIES,
    CATEGORY_TITLES,
    type ExampleLayout,
    type ExampleMeta,
} from "#/examples/meta-types";
import type { ItemRef, Kind } from "./view";

// Everything the playground can show, read where it lives. Components and sources are loaded
// only when shown.
//
//   examples   examples/react/src/examples/<slug>/ (index.tsx + meta.ts), the site's gallery:
//              public, contract-bound; there is no second list here
//   scenarios  src/scenarios/<area>/<id>.tsx, found by path: dev-only, never shipped; a file is
//              all it takes to add one
//   fixtures   fixtures/<name>/index.html, the unstyled pages Playwright drives: links out

export type SourceFile = {
    /** Where the file lives, from the repository root. */
    path: string;
    /** The file, verbatim. */
    load: () => Promise<string>;
};

export type Entry = {
    kind: Kind;
    id: string;
    title: string;
    /** Group key and title in the sidebar. */
    group: string;
    groupTitle: string;
    /** One line under the title. */
    description?: string;
    features: string[];
    /** `fill` stretches to the stage; `flow` takes its content's height. */
    layout: ExampleLayout;
    load: () => Promise<{ default: ComponentType }>;
    /** What the source panel shows, entry file first. */
    files: SourceFile[];
};

export type Section = {
    kind: Kind;
    title: string;
    groups: { key: string; title: string; entries: Entry[] }[];
};

export type Fixture = { name: string; title: string; href: string };

// Glob keys are relative to this file, which is apps/playground/src.
export function repositoryPath(key: string): string {
    return new URL(key, "file:///apps/playground/src/").pathname.slice(1);
}

// ─── Examples ───────────────────────────────────────────────────────────────

const EXAMPLES = "../../../examples/react/src/examples";

const exampleModules = import.meta.glob<{ default: ComponentType }>(
    "../../../examples/react/src/examples/*/index.tsx",
);
const exampleMetas = import.meta.glob<{ default: ExampleMeta }>(
    "../../../examples/react/src/examples/*/meta.ts",
    { eager: true },
);
const exampleSources = import.meta.glob<string>(
    [
        "../../../examples/react/src/examples/*/*.{ts,tsx,css}",
        "!../../../examples/react/src/examples/_*/**",
        "!../../../examples/react/src/examples/*/meta.ts",
    ],
    { query: "?raw", import: "default" },
);

/** `…/examples/<slug>/<file>` → `<slug>`, or nothing for a `_` folder or a loose file. */
export function exampleSlug(key: string): string | undefined {
    const match = /\/examples\/([^/_][^/]*)\/[^/]+$/.exec(key);
    return match?.[1];
}

function exampleFiles(slug: string): SourceFile[] {
    const entry = `${EXAMPLES}/${slug}/index.tsx`;
    return Object.entries(exampleSources)
        .filter(([key]) => exampleSlug(key) === slug)
        .sort(([a], [b]) => {
            if (a === entry) return -1;
            if (b === entry) return 1;
            return a.localeCompare(b);
        })
        .map(([key, load]) => ({ path: repositoryPath(key), load }));
}

const exampleEntries: Entry[] = Object.entries(exampleModules)
    .flatMap(([key, load]) => {
        const slug = exampleSlug(key);
        const meta = exampleMetas[`${EXAMPLES}/${slug}/meta.ts`]?.default;
        if (!slug || !meta) return [];
        return [
            {
                entry: {
                    kind: "example" as const,
                    id: slug,
                    title: meta.title,
                    group: meta.category,
                    groupTitle: CATEGORY_TITLES[meta.category],
                    description: meta.description,
                    features: meta.features,
                    layout: meta.layout ?? "fill",
                    load,
                    files: exampleFiles(slug),
                },
                order: meta.order,
            },
        ];
    })
    .sort((a, b) => a.order - b.order || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => entry);

// ─── Scenarios ──────────────────────────────────────────────────────────────

/** The areas of the package a scenario exercises: `src/scenarios/<area>/`, in sidebar order. */
export const AREAS = [
    { key: "layout", title: "Layout" },
    { key: "drag", title: "Drag and drop" },
    { key: "borders", title: "Borders" },
    { key: "popout", title: "Popout" },
    { key: "api", title: "API" },
] as const;

const scenarioModules = import.meta.glob<{ default: ComponentType }>(
    "./scenarios/*/*.tsx",
);
const scenarioSources = import.meta.glob<string>("./scenarios/*/*.tsx", {
    query: "?raw",
    import: "default",
});

/** `./scenarios/<area>/<id>.tsx` → its area and id, or nothing. */
export function scenarioPath(
    key: string,
): { area: string; id: string } | undefined {
    const match = /^\.\/scenarios\/([^/]+)\/([^/]+)\.tsx$/.exec(key);
    if (!match?.[1] || !match[2]) return undefined;
    return { area: match[1], id: match[2] };
}

/** `drop-indicator-motion` → `Drop indicator motion`. */
export function scenarioTitle(id: string): string {
    const words = id.replaceAll("-", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

// A file outside an area's directory is not listed; tests/scenarios.test.ts fails on it instead.
const scenarioEntries: Entry[] = Object.entries(scenarioModules)
    .flatMap(([key, load]) => {
        const path = scenarioPath(key);
        const area = AREAS.find((a) => a.key === path?.area);
        const source = scenarioSources[key];
        if (!path || !area || !source) return [];
        return [
            {
                kind: "scenario" as const,
                id: `${path.area}/${path.id}`,
                title: scenarioTitle(path.id),
                group: area.key,
                groupTitle: area.title,
                features: [],
                layout: "fill" as const,
                load,
                files: [{ path: repositoryPath(key), load: source }],
            },
        ];
    })
    .sort((a, b) => a.title.localeCompare(b.title));

// ─── Sections ───────────────────────────────────────────────────────────────

function section(
    kind: Kind,
    title: string,
    groups: readonly { key: string; title: string }[],
    entries: Entry[],
): Section {
    return {
        kind,
        title,
        groups: groups
            .map((group) => ({
                ...group,
                entries: entries.filter((entry) => entry.group === group.key),
            }))
            .filter((group) => group.entries.length > 0),
    };
}

export const sections: Section[] = [
    section(
        "example",
        "Examples",
        CATEGORIES.map((category) => ({
            key: category,
            title: CATEGORY_TITLES[category],
        })),
        exampleEntries,
    ),
    section("scenario", "Scenarios", AREAS, scenarioEntries),
].filter((s) => s.groups.length > 0);

export const entries: Entry[] = sections.flatMap((s) =>
    s.groups.flatMap((g) => g.entries),
);

export function findEntry(ref: ItemRef | null): Entry | undefined {
    if (!ref) return undefined;
    return entries.find((e) => e.kind === ref.kind && e.id === ref.id);
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const fixturePages = import.meta.glob<string>("../fixtures/*/index.html", {
    query: "?raw",
    import: "default",
    eager: true,
});

/** Each fixture page, titled by its `<title>`; each opens with its own default layout. */
export const fixtures: Fixture[] = Object.entries(fixturePages)
    .flatMap(([key, html]) => {
        const name = /^\.\.\/fixtures\/([^/]+)\/index\.html$/.exec(key)?.[1];
        if (!name) return [];
        const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? name;
        return [{ name, title, href: `/fixtures/${name}/` }];
    })
    .sort((a, b) => a.title.localeCompare(b.title));
