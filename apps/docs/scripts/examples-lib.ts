// Shared by scripts/build-examples.ts and the tests: finds the examples, reads
// their meta.ts, and computes the files each one is made of by following its
// relative imports. What the code panel shows is exactly this list.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type ExampleMeta, LEVELS } from "../examples/meta-types.ts";

export const APP_ROOT = resolve(import.meta.dirname, "..");
export const EXAMPLES_DIR = join(APP_ROOT, "examples");

export interface ExampleEntry {
    slug: string;
    meta: ExampleMeta;
    /** the example's source files, relative to examples/, entry first */
    files: string[];
    /** the Fragiola UI registry items it imports (install them with the registry CLI) */
    registry: string[];
}

/** Every folder under examples/ with an index.tsx, except the `_` ones (kit, themes). */
export function listExampleSlugs(): string[] {
    return readdirSync(EXAMPLES_DIR)
        .filter((name) => !name.startsWith("_"))
        .filter((name) => statSync(join(EXAMPLES_DIR, name)).isDirectory())
        .filter((name) => existsSync(join(EXAMPLES_DIR, name, "index.tsx")))
        .sort();
}

/** Throws with a readable message when a meta.ts is not an ExampleMeta. */
export function validateMeta(slug: string, value: unknown): ExampleMeta {
    const fail = (why: string): never => {
        throw new Error(`examples/${slug}/meta.ts: ${why}`);
    };
    if (!value || typeof value !== "object") fail("no default export object");
    const meta = value as Record<string, unknown>;
    if (typeof meta.title !== "string" || !meta.title)
        fail("title is required");
    if (typeof meta.description !== "string" || !meta.description) {
        fail("description is required");
    }
    if (!LEVELS.includes(meta.level as never)) {
        fail(`level must be one of ${LEVELS.join(", ")}`);
    }
    if (typeof meta.order !== "number") fail("order must be a number");
    if (
        !Array.isArray(meta.features) ||
        !meta.features.every((f) => typeof f === "string")
    ) {
        fail("features must be a string array");
    }
    if (meta.docs !== undefined && typeof meta.docs !== "string") {
        fail("docs must be a string");
    }
    return meta as unknown as ExampleMeta;
}

export async function readMeta(slug: string): Promise<ExampleMeta> {
    const file = join(EXAMPLES_DIR, slug, "meta.ts");
    if (!existsSync(file)) {
        throw new Error(`examples/${slug}: meta.ts is missing`);
    }
    const module = (await import(pathToFileURL(file).href)) as {
        default?: unknown;
    };
    return validateMeta(slug, module.default);
}

// Statements start a line (so an import written inside a string, e.g. a demo file's
// contents, is not taken for one); dynamic imports can appear anywhere.
const SPECIFIER =
    /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;

/** The module specifiers a source file imports (static, re-exports and dynamic). */
export function importsOf(source: string): string[] {
    const specifiers: string[] = [];
    for (const match of source.matchAll(SPECIFIER)) {
        const specifier = match[1] ?? match[2];
        if (specifier) specifiers.push(specifier);
    }
    return specifiers;
}

function resolveRelative(from: string, specifier: string): string | undefined {
    const base = resolve(dirname(from), specifier);
    const candidates = [
        base,
        `${base}.tsx`,
        `${base}.ts`,
        join(base, "index.tsx"),
        join(base, "index.ts"),
    ];
    return candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    );
}

/** `@/components/ui/select` → `select`: the registry item a vendored import comes from. */
export function registryItemOf(specifier: string): string | undefined {
    const match =
        /^@\/components\/(?:ui|atoms)\/([^/]+)/.exec(specifier) ??
        /^@\/lib\/(cn)$/.exec(specifier);
    return match?.[1];
}

/**
 * The example's files: its index.tsx and everything reachable through relative imports, all
 * inside examples/. Returned relative to examples/, the entry first, the rest sorted.
 */
export function collectFiles(slug: string): {
    files: string[];
    registry: string[];
} {
    const entry = join(EXAMPLES_DIR, slug, "index.tsx");
    const seen = new Set<string>();
    const registry = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
        const file = queue.shift();
        if (file === undefined || seen.has(file)) continue;
        seen.add(file);
        for (const specifier of importsOf(readFileSync(file, "utf-8"))) {
            if (specifier.startsWith(".")) {
                const target = resolveRelative(file, specifier);
                if (!target) {
                    throw new Error(
                        `${relative(APP_ROOT, file)}: cannot resolve "${specifier}"`,
                    );
                }
                if (!target.startsWith(EXAMPLES_DIR)) {
                    throw new Error(
                        `${relative(APP_ROOT, file)}: "${specifier}" leaves examples/`,
                    );
                }
                queue.push(target);
            } else {
                const item = registryItemOf(specifier);
                if (item) registry.add(item);
            }
        }
    }
    const [first, ...rest] = [...seen].map((file) =>
        relative(EXAMPLES_DIR, file),
    );
    return {
        files: first === undefined ? [] : [first, ...rest.sort()],
        registry: [...registry].sort(),
    };
}

export async function loadExamples(): Promise<ExampleEntry[]> {
    const entries: ExampleEntry[] = [];
    for (const slug of listExampleSlugs()) {
        const meta = await readMeta(slug);
        entries.push({ slug, meta, ...collectFiles(slug) });
    }
    return entries.sort(
        (a, b) =>
            LEVELS.indexOf(a.meta.level) - LEVELS.indexOf(b.meta.level) ||
            a.meta.order - b.meta.order ||
            a.slug.localeCompare(b.slug),
    );
}
