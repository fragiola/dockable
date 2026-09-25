import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The docs tree links to itself and to the examples browser. This test resolves every internal
// link in content/docs against the page tree (the .mdx files) and the example slugs, checks the
// navigation (meta.json) lists every page, that every guide links an example, and that every
// example's `meta.docs` points at an existing page.

const DOCS = join(import.meta.dirname, "../content/docs");
const EXAMPLES_DIR = join(import.meta.dirname, "../examples");

/**
 * The examples of the docs Epic, by slug. Some are written in parallel with the docs, so the
 * list is fixed here rather than read from examples/ (which may not have them yet). Every folder
 * that does exist under examples/ is added too.
 */
const EXAMPLE_SLUGS = new Set([
    // basic
    "hello-layout",
    "unstyled",
    "splitter-hairline",
    "splitter-wide",
    "add-tabs",
    "close-tabs",
    "focused-tab",
    "tabs-at-bottom",
    "save-restore",
    "keyboard",
    // intermediate
    "content-aware-tabs",
    "overflow-select",
    "tab-context-menu",
    "rename-tabs",
    "maximize",
    "pinned-tabs",
    "undo-redo",
    "drag-and-drop",
    "locked-regions",
    "popout",
    "scoped-palettes",
    "component-factory",
    // advanced
    "ide-workbench",
    "analytics-dashboard",
    "ops-monitor",
    "layout-lab",
    ...readdirSync(EXAMPLES_DIR).filter(
        (name) =>
            !name.startsWith("_") &&
            statSync(join(EXAMPLES_DIR, name)).isDirectory() &&
            existsSync(join(EXAMPLES_DIR, name, "meta.ts")),
    ),
]);

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

const files = walk(DOCS);
const pages = files.filter((file) => file.endsWith(".mdx"));

/** "/docs/guides/tabs" for content/docs/guides/tabs.mdx. */
function urlOf(file: string): string {
    return `/docs/${relative(DOCS, file)
        .replace(/\.mdx$/, "")
        .replace(/(^|\/)index$/, "")}`;
}

const PAGE_URLS = new Set(pages.map(urlOf));

/** Markdown and MDX headings of a page, as Fumadocs slugs them (lower case, dashed). */
function anchors(file: string): Set<string> {
    const source = readFileSync(file, "utf-8").replace(/```[\s\S]*?```/g, "");
    const slugs = new Set<string>();
    for (const match of source.matchAll(/^#{2,6} (.+)$/gm)) {
        slugs.add(
            (match[1] ?? "")
                .toLowerCase()
                .replace(/`/g, "")
                .replace(/[^\p{L}\p{N}\s-]/gu, "")
                .trim()
                .replace(/\s+/g, "-"),
        );
    }
    return slugs;
}

interface Link {
    file: string;
    href: string;
}

/** Every internal link of a page: markdown links, href="…", and <Example slug="…" />. */
function linksOf(file: string): Link[] {
    const source = readFileSync(file, "utf-8").replace(/```[\s\S]*?```/g, "");
    const links: Link[] = [];
    for (const match of source.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        links.push({ file, href: match[1] ?? "" });
    }
    for (const match of source.matchAll(/href="(\/[^"]*)"/g)) {
        links.push({ file, href: match[1] ?? "" });
    }
    for (const match of source.matchAll(/<Example\s+slug="([^"]+)"/g)) {
        links.push({ file, href: `/examples/${match[1]}/` });
    }
    return links;
}

const LINKS = pages.flatMap(linksOf);

function resolves(href: string): string | undefined {
    const [path = "", hash] = href.split("#");
    const clean = path.replace(/\/$/, "");
    if (clean === "/examples") return undefined;
    const example = /^\/examples\/([^/]+)$/.exec(clean);
    if (example) {
        return EXAMPLE_SLUGS.has(example[1] ?? "")
            ? undefined
            : `unknown example "${example[1]}"`;
    }
    if (clean === "/docs") return undefined;
    if (clean.startsWith("/docs/")) {
        if (!PAGE_URLS.has(clean)) return `no page ${clean}`;
        if (hash) {
            const file = pages.find((page) => urlOf(page) === clean);
            if (file && !anchors(file).has(hash)) {
                return `no heading #${hash} on ${clean}`;
            }
        }
        return undefined;
    }
    return `unexpected internal link ${href}`;
}

describe("the docs tree", () => {
    it("has pages", () => {
        expect(pages.length).toBeGreaterThan(40);
        expect(LINKS.length).toBeGreaterThan(100);
    });

    it("resolves every internal link", () => {
        const broken = LINKS.flatMap(({ file, href }) => {
            const problem = resolves(href);
            return problem ? [`${relative(DOCS, file)}: ${problem}`] : [];
        });
        expect(broken).toEqual([]);
    });

    it("lists every page in a meta.json, and every meta.json entry exists", () => {
        const listed = new Set<string>();
        for (const meta of files.filter((file) => file.endsWith("meta.json"))) {
            const dir = join(meta, "..");
            const { pages: entries = [] } = JSON.parse(
                readFileSync(meta, "utf-8"),
            ) as { pages?: string[] };
            for (const entry of entries) {
                if (entry.startsWith("---") || entry.startsWith("[")) continue;
                const path = join(dir, entry);
                const exists =
                    existsSync(`${path}.mdx`) ||
                    existsSync(join(path, "meta.json"));
                expect(exists, `${relative(DOCS, meta)} lists "${entry}"`).toBe(
                    true,
                );
                if (existsSync(`${path}.mdx`)) listed.add(`${path}.mdx`);
            }
        }
        const unlisted = pages.filter((page) => !listed.has(page));
        expect(unlisted.map((page) => relative(DOCS, page))).toEqual([]);
    });

    it("links at least one example from every guide", () => {
        const guides = pages.filter((page) =>
            relative(DOCS, page).startsWith("guides/"),
        );
        expect(guides.length).toBeGreaterThan(10);
        for (const guide of guides) {
            expect(
                linksOf(guide).some(({ href }) =>
                    href.startsWith("/examples/"),
                ),
                relative(DOCS, guide),
            ).toBe(true);
        }
    });

    it("has a page for every example's meta.docs", () => {
        for (const slug of EXAMPLE_SLUGS) {
            const meta = join(EXAMPLES_DIR, slug, "meta.ts");
            if (!existsSync(meta)) continue; // not written yet
            const docs = /docs:\s*"([^"]+)"/.exec(readFileSync(meta, "utf-8"));
            if (docs?.[1]) {
                expect(
                    resolves(docs[1]),
                    `${slug}: ${docs[1]}`,
                ).toBeUndefined();
            }
        }
    });
});
