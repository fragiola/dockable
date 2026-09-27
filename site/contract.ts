// The site export contract, v1 (fragiola/www CONTRACT.md): its types, and the checks this repo
// runs on what it exports. `www` runs the same checks on every build; running them here first
// means an export that `www` would reject never leaves this repo.
//
// - `validateExport(dir)` reads a finished export (site/export.ts runs it on its output);
// - `validateSite(site)` checks the same things in memory (the tests run it on the sources).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const CONTRACT = 1;

// ─── types ───────────────────────────────────────────────────────────────────

export interface ProjectInfo {
    contract: number;
    slug: string;
    title: string;
    description: string;
    frameworks: string[];
    defaultFramework: string;
    registry?: { namespace: string };
}

export type SidebarEntry =
    | { label: string; path: string }
    | { label: string; href: string; external: true };

export interface DocsConfig {
    sections: { label: string; framework?: string; pages: SidebarEntry[] }[];
}

export interface ExamplesConfig {
    levels: { id: string; title: string }[];
    themes: {
        name: string;
        title: string;
        description: string;
        scheme: "light" | "dark";
        swatch: string[];
        file?: { path: string; lang: string; content: string };
    }[];
}

export interface Manifest {
    files: Record<string, { lang: string; content: string; shared?: boolean }>;
    examples: {
        id: string;
        title: string;
        description: string;
        level: string;
        order: number;
        features: string[];
        docs?: string;
        layout: "fill" | "flow";
        height: number;
        files: string[];
        registry: string[];
        packages: string[];
    }[];
}

/** An export, in memory. `pages` maps a page path (`guides/tabs`, `index`) to its MDX. */
export interface Site {
    project: ProjectInfo;
    config: DocsConfig;
    pages: Map<string, string>;
    examples: ExamplesConfig;
    manifests: Map<string, Manifest>;
    /** registry item names in r/, when the project exports a registry */
    registry?: Set<string>;
}

// ─── MDX ─────────────────────────────────────────────────────────────────────

/** The v1 vocabulary: each component and the props it takes (§3.4). */
const VOCABULARY: Record<string, { props: string[]; required: string[] }> = {
    Example: {
        props: ["id", "framework", "theme", "height", "variant"],
        required: ["id"],
    },
    Callout: { props: ["type", "title"], required: ["type"] },
    Tabs: { props: ["items"], required: ["items"] },
    Tab: { props: ["value"], required: ["value"] },
    Steps: { props: [], required: [] },
    Step: { props: [], required: [] },
    Cards: { props: [], required: [] },
    Card: {
        props: ["title", "href", "description"],
        required: ["title", "href"],
    },
    InstallCommand: { props: ["item"], required: ["item"] },
    Framework: { props: ["name"], required: ["name"] },
    Hero: {
        props: ["title", "description", "actions"],
        required: ["title"],
    },
};

const VARIANTS = ["inline", "bleed", "card"];
const CALLOUTS = ["info", "warn", "danger"];

/** The frontmatter's `key: value` lines. */
export function frontmatter(source: string): Record<string, string> {
    const block = /^---\n([\s\S]*?)\n---\n/.exec(source)?.[1];
    const fields: Record<string, string> = {};
    for (const line of block?.split("\n") ?? []) {
        const match = /^([A-Za-z]\w*):\s*(.*)$/.exec(line);
        if (match?.[1]) {
            fields[match[1]] = (match[2] ?? "").replace(/^(["'])(.*)\1$/, "$2");
        }
    }
    return fields;
}

/**
 * The page's prose: frontmatter, fenced code and inline code blanked out (line count kept, so
 * line numbers stay right), plus the fences' info strings, which must name a language.
 */
function prose(
    source: string,
    { keepInlineCode = false } = {},
): { text: string; fences: { line: number; info: string }[] } {
    const fences: { line: number; info: string }[] = [];
    let fence: string | undefined;
    const lines = source.split("\n");
    let inFrontmatter = lines[0] === "---";
    const text = lines
        .map((line, index) => {
            if (inFrontmatter) {
                if (index > 0 && line === "---") inFrontmatter = false;
                return "";
            }
            const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
            if (marker?.[1]) {
                if (!fence) {
                    fence = marker[1];
                    fences.push({
                        line: index + 1,
                        info: (marker[2] ?? "").trim(),
                    });
                } else if (marker[1].startsWith(fence) && !marker[2]?.trim()) {
                    fence = undefined;
                }
                return "";
            }
            if (fence) return "";
            return line
                .replace(/(`+)([\s\S]*?)\1/g, (code, _ticks, inner: string) =>
                    keepInlineCode ? inner : " ".repeat(code.length),
                )
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        })
        .join("\n");
    return { text, fences };
}

interface Tag {
    name: string;
    props: Map<string, string>;
    line: number;
}

const ATTRIBUTES = String.raw`(?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*`;

/** The JSX tags of the prose (opening and self-closing), with their raw props. */
function tagsOf(text: string): Tag[] {
    const tags: Tag[] = [];
    const pattern = new RegExp(
        String.raw`<([A-Za-z][\w.]*)(?![\w.:])(${ATTRIBUTES})>`,
        "g",
    );
    for (const match of text.matchAll(pattern)) {
        const props = new Map<string, string>();
        const attributes = (match[2] ?? "").replace(/\/$/, "");
        const prop =
            /([A-Za-z][\w-]*)(?:=("[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}))?/g;
        for (const [, key, value] of attributes.matchAll(prop)) {
            if (key) props.set(key, value ?? "true");
        }
        tags.push({
            name: match[1] ?? "",
            props,
            line: text.slice(0, match.index).split("\n").length,
        });
    }
    return tags;
}

/** A prop's string value (`"x"`, `'x'` or `{"x"}`), or undefined for an expression. */
function stringProp(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const quoted = /^(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\})$/.exec(value);
    return quoted ? (quoted[1] ?? quoted[2] ?? quoted[3]) : undefined;
}

/** Heading anchors, the way Fumadocs (github-slugger) makes them, duplicates numbered. */
export function anchorsOf(source: string): Set<string> {
    const anchors = new Set<string>();
    const counts = new Map<string, number>();
    const { text } = prose(source, { keepInlineCode: true });
    for (const [, heading] of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
        const base = (heading ?? "")
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/[*_~]/g, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, "")
            .trim()
            .replace(/\s/g, "-");
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        anchors.add(count === 0 ? base : `${base}-${count}`);
    }
    return anchors;
}

/** Every link target of a page, with its line: markdown links, references, href props, Hero actions. */
function linksOf(text: string): { href: string; line: number }[] {
    const links: { href: string; line: number }[] = [];
    const lineOf = (index: number) => text.slice(0, index).split("\n").length;
    const patterns = [
        /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
        /^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm,
        /\bhref(?:=|:\s*)["']([^"']+)["']/g,
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            if (match[1])
                links.push({ href: match[1], line: lineOf(match.index) });
        }
    }
    return links;
}

// ─── checks ──────────────────────────────────────────────────────────────────

export function validateSite(site: Site): string[] {
    const problems: string[] = [];
    const { project, config, pages, examples, manifests } = site;

    // project.json
    if (project.contract !== CONTRACT) {
        problems.push(
            `project.json: contract ${project.contract}, expected ${CONTRACT}`,
        );
    }
    for (const key of ["slug", "title", "description"] as const) {
        if (!project[key]) problems.push(`project.json: ${key} is required`);
    }
    if (!project.frameworks.includes(project.defaultFramework)) {
        problems.push(
            `project.json: defaultFramework "${project.defaultFramework}" is not in frameworks`,
        );
    }
    if (Boolean(project.registry) !== Boolean(site.registry)) {
        problems.push("project.json: registry.namespace and r/ go together");
    }

    // examples.json
    const levels = new Set(examples.levels.map((level) => level.id));
    if (levels.size !== examples.levels.length)
        problems.push("examples.json: duplicate level id");
    const themes = new Set(examples.themes.map((theme) => theme.name));
    if (themes.size !== examples.themes.length)
        problems.push("examples.json: duplicate theme name");
    for (const scheme of ["light", "dark"]) {
        if (!examples.themes.some((theme) => theme.scheme === scheme)) {
            problems.push(`examples.json: no ${scheme} theme`);
        }
    }
    for (const theme of examples.themes) {
        if (!["light", "dark"].includes(theme.scheme)) {
            problems.push(
                `examples.json: theme "${theme.name}" has scheme "${theme.scheme}"`,
            );
        }
        if (theme.file && !theme.file.content) {
            problems.push(
                `examples.json: theme "${theme.name}" has an empty file`,
            );
        }
    }

    // pages: config ↔ files
    const listed = new Map<string, number>();
    for (const section of config.sections) {
        if (
            section.framework &&
            !project.frameworks.includes(section.framework)
        ) {
            problems.push(
                `config.json: section "${section.label}" names framework "${section.framework}"`,
            );
        }
        for (const entry of section.pages) {
            if ("path" in entry) {
                listed.set(entry.path, (listed.get(entry.path) ?? 0) + 1);
                if (!pages.has(entry.path)) {
                    problems.push(
                        `config.json: ${entry.path}.mdx does not exist`,
                    );
                }
            } else if (
                !/^https?:\/\//.test(entry.href) ||
                entry.external !== true
            ) {
                problems.push(
                    `config.json: "${entry.label}" needs an absolute href and external: true`,
                );
            }
        }
    }
    for (const [path, count] of listed) {
        if (count > 1)
            problems.push(`config.json: ${path} is listed ${count} times`);
    }
    if (!pages.has("index")) problems.push("docs/index.mdx is missing");
    for (const path of pages.keys()) {
        if (path !== "index" && !listed.has(path)) {
            problems.push(`config.json: ${path}.mdx is not listed`);
        }
    }

    // examples: the manifests
    const exampleIds = new Set<string>();
    for (const [framework, manifest] of manifests) {
        const ids = new Set<string>();
        for (const example of manifest.examples) {
            const where = `embed/${framework}/manifest.json: ${example.id}`;
            if (ids.has(example.id)) problems.push(`${where}: duplicate id`);
            ids.add(example.id);
            exampleIds.add(example.id);
            if (!levels.has(example.level))
                problems.push(`${where}: unknown level "${example.level}"`);
            if (!["fill", "flow"].includes(example.layout))
                problems.push(`${where}: layout "${example.layout}"`);
            if (!(example.height > 0))
                problems.push(`${where}: height must be positive`);
            if (example.files.length === 0) problems.push(`${where}: no files`);
            for (const file of example.files) {
                if (!manifest.files[file])
                    problems.push(`${where}: file ${file} is not in files`);
            }
            for (const item of example.registry) {
                if (item.includes("/"))
                    problems.push(
                        `${where}: registry item "${item}" is namespaced`,
                    );
            }
        }
    }

    // pages: frontmatter, vocabulary, links
    const anchors = new Map(
        [...pages].map(([path, source]) => [path, anchorsOf(source)]),
    );
    const resolve = (href: string, from: string): string | undefined => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return undefined; // https:, mailto:
        const [path = "", hash] = href.split("#");
        if (path === "") {
            return hash && !anchors.get(from)?.has(hash)
                ? `no heading #${hash} on this page`
                : undefined;
        }
        if (!path.startsWith("/"))
            return `relative link "${href}" (write it base-free, from /)`;
        if (path === "/" || path === "/examples") return undefined;
        const example = /^\/examples\/([^/]+)$/.exec(path);
        if (example) {
            return exampleIds.has(example[1] ?? "")
                ? undefined
                : `no example "${example[1]}"`;
        }
        const page = /^\/docs\/(.+)$/.exec(path)?.[1];
        if (page === undefined || !pages.has(page) || page === "index")
            return `no page ${path}`;
        if (hash && !anchors.get(page)?.has(hash))
            return `no heading #${hash} on ${path}`;
        return undefined;
    };

    for (const [path, source] of pages) {
        const file = `docs/${path}.mdx`;
        const fields = frontmatter(source);
        for (const key of ["title", "description"]) {
            if (!fields[key])
                problems.push(`${file}: frontmatter ${key} is required`);
        }
        if (path === "index" && fields.layout !== "landing") {
            problems.push(`${file}: frontmatter layout must be "landing"`);
        }
        const { text, fences } = prose(source);
        for (const fence of fences) {
            if (!/^[\w+-]+(\s+title="[^"]*")?$/.test(fence.info)) {
                problems.push(
                    `${file}:${fence.line}: a code block takes a language and an optional title="…" (got "${fence.info}")`,
                );
            }
        }
        for (const [index, line] of text.split("\n").entries()) {
            if (/^\s*(import|export)\s/.test(line)) {
                problems.push(
                    `${file}:${index + 1}: import/export is not allowed`,
                );
            }
        }
        for (const tag of tagsOf(text)) {
            const where = `${file}:${tag.line}`;
            const spec = VOCABULARY[tag.name];
            if (!spec) {
                problems.push(
                    `${where}: <${tag.name}> is not in the v1 vocabulary`,
                );
                continue;
            }
            for (const key of tag.props.keys()) {
                if (!spec.props.includes(key))
                    problems.push(`${where}: <${tag.name}> takes no "${key}"`);
            }
            for (const key of spec.required) {
                if (!tag.props.has(key))
                    problems.push(`${where}: <${tag.name}> needs "${key}"`);
            }
            const value = (key: string) => stringProp(tag.props.get(key));
            if (tag.name === "Example") {
                const id = value("id");
                if (!id || !exampleIds.has(id))
                    problems.push(
                        `${where}: <Example id="${id}"> is not an example`,
                    );
                const variant = value("variant");
                if (
                    tag.props.has("variant") &&
                    !VARIANTS.includes(variant ?? "")
                ) {
                    problems.push(`${where}: <Example variant="${variant}">`);
                }
                const theme = value("theme");
                if (tag.props.has("theme") && !themes.has(theme ?? "")) {
                    problems.push(
                        `${where}: <Example theme="${theme}"> is not in examples.json`,
                    );
                }
                const framework = value("framework");
                if (
                    tag.props.has("framework") &&
                    !project.frameworks.includes(framework ?? "")
                ) {
                    problems.push(
                        `${where}: <Example framework="${framework}">`,
                    );
                }
                if (
                    tag.props.has("height") &&
                    !/^\{\s*\d+\s*\}$/.test(tag.props.get("height") ?? "")
                ) {
                    problems.push(`${where}: <Example height> takes a number`);
                }
            }
            if (
                tag.name === "Callout" &&
                !CALLOUTS.includes(value("type") ?? "")
            ) {
                problems.push(`${where}: <Callout type="${value("type")}">`);
            }
            if (
                tag.name === "Framework" &&
                !project.frameworks.includes(value("name") ?? "")
            ) {
                problems.push(`${where}: <Framework name="${value("name")}">`);
            }
            if (
                tag.name === "InstallCommand" &&
                !site.registry?.has(value("item") ?? "")
            ) {
                problems.push(
                    `${where}: <InstallCommand item="${value("item")}"> is not in r/`,
                );
            }
            if (tag.name === "Hero" && path !== "index") {
                problems.push(`${where}: <Hero> belongs on the landing only`);
            }
        }
        for (const [index, line] of text.split("\n").entries()) {
            for (const [, name] of line.matchAll(/<\/([A-Za-z][\w.]*)\s*>/g)) {
                if (name && !VOCABULARY[name]) {
                    problems.push(
                        `${file}:${index + 1}: </${name}> is not in the v1 vocabulary`,
                    );
                }
            }
        }
        for (const link of linksOf(text)) {
            const problem = resolve(link.href, path);
            if (problem) problems.push(`${file}:${link.line}: ${problem}`);
        }
    }

    // the manifests' docs links
    for (const [framework, manifest] of manifests) {
        for (const example of manifest.examples) {
            const problem = example.docs && resolve(example.docs, "index");
            if (problem)
                problems.push(
                    `embed/${framework}/manifest.json: ${example.id}: docs ${problem}`,
                );
        }
    }
    return problems;
}

// ─── reading an export ───────────────────────────────────────────────────────

const readJson = <T>(file: string): T =>
    JSON.parse(readFileSync(file, "utf-8")) as T;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

/** The pages of a docs directory, by page path. */
export function readPages(docs: string): Map<string, string> {
    return new Map(
        walk(docs)
            .filter((file) => file.endsWith(".mdx"))
            .map((file) => [
                relative(docs, file).replace(/\.mdx$/, ""),
                readFileSync(file, "utf-8"),
            ]),
    );
}

/** Checks a finished export: the in-memory checks, plus the files each part must have. */
export function validateExport(out: string, base: string): string[] {
    const problems: string[] = [];
    for (const file of [
        "project.json",
        "examples.json",
        "docs/config.json",
        "docs/index.mdx",
    ]) {
        if (!existsSync(join(out, file))) problems.push(`${file} is missing`);
    }
    if (problems.length > 0) return problems;
    const project = readJson<ProjectInfo>(join(out, "project.json"));
    const manifests = new Map<string, Manifest>();
    for (const framework of project.frameworks) {
        const dir = join(out, "embed", framework);
        for (const file of ["index.html", "manifest.json"]) {
            if (!existsSync(join(dir, file)))
                problems.push(`embed/${framework}/${file} is missing`);
        }
        const index = join(dir, "index.html");
        const embedBase = `${base}/embed/${framework}/`;
        if (
            existsSync(index) &&
            !readFileSync(index, "utf-8").includes(`"${embedBase}`)
        ) {
            problems.push(
                `embed/${framework}/index.html was not built for ${embedBase}`,
            );
        }
        if (existsSync(join(dir, "manifest.json"))) {
            manifests.set(
                framework,
                readJson<Manifest>(join(dir, "manifest.json")),
            );
        }
    }
    let registry: Set<string> | undefined;
    if (existsSync(join(out, "r"))) {
        const index = readJson<{ items: { name: string }[] }>(
            join(out, "r", "index.json"),
        );
        registry = new Set(index.items.map((item) => item.name));
    }
    return [
        ...problems,
        ...validateSite({
            project,
            config: readJson<DocsConfig>(join(out, "docs", "config.json")),
            pages: readPages(join(out, "docs")),
            examples: readJson<ExamplesConfig>(join(out, "examples.json")),
            manifests,
            ...(registry ? { registry } : {}),
        }),
    ];
}
