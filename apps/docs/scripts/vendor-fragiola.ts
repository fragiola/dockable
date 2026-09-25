// Vendors Fragiola UI registry items into this app, the way a consumer gets them.
//
//   node scripts/vendor-fragiola.ts [item…]
//
// Fragiola UI is a copy-paste library (shadcn registry format): there is no package to
// install. Each item is a JSON file listing its files (with their content and a `~/` target)
// and its registry dependencies. This script resolves the dependencies transitively, writes
// every file to its target under apps/docs, and prepends a header naming the source.
//
// The registry is read from FRAGIOLA_REGISTRY (a URL or a local `public/r` directory),
// defaulting to the deployed one. The vendored files are committed: the build never fetches.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

interface RegistryFile {
    path: string;
    target: string;
    content: string;
}

interface RegistryItem {
    name: string;
    dependencies?: string[];
    registryDependencies?: string[];
    files: RegistryFile[];
}

const REGISTRY = process.env.FRAGIOLA_REGISTRY ?? "https://ui.fragiola.com/r";
const APP_ROOT = resolve(import.meta.dirname, "..");

/** The items the docs and the examples use. Their registry dependencies come along. */
const DEFAULT_ITEMS = [
    "theme",
    "palette-surface",
    "palette-raised",
    "palette-blue",
    "palette-orange",
    "palette-green",
    "palette-danger",
    "palette-purple",
    "palette-rose",
    "alert-dialog",
    "badge",
    "chart",
    "context-menu",
    "dialog",
    "dropdown-menu",
    "field",
    "input",
    "popover",
    "progress",
    "select",
    "separator",
    "skeleton",
    "switch",
    "table",
    "tabs",
    "tooltip",
];

async function fetchItem(name: string): Promise<RegistryItem> {
    if (/^https?:/.test(REGISTRY)) {
        const response = await fetch(`${REGISTRY}/${name}.json`);
        if (!response.ok) {
            throw new Error(`${name}: HTTP ${response.status}`);
        }
        return (await response.json()) as RegistryItem;
    }
    return JSON.parse(
        await readFile(join(REGISTRY, `${name}.json`), "utf-8"),
    ) as RegistryItem;
}

function header(file: RegistryFile, item: RegistryItem): string {
    const text = `Vendored from the Fragiola UI registry (${REGISTRY}/${item.name}.json, source ${file.path}). Do not edit: re-run scripts/vendor-fragiola.ts.`;
    return file.target.endsWith(".css") ? `/* ${text} */\n` : `// ${text}\n`;
}

/** Keeps a leading "use client" directive first, as React requires. */
function withHeader(file: RegistryFile, item: RegistryItem): string {
    const directive = /^(["'])use client\1;?\n/.exec(file.content);
    if (directive) {
        return `${directive[0]}${header(file, item)}${file.content.slice(directive[0].length)}`;
    }
    return `${header(file, item)}${file.content}`;
}

async function main() {
    const requested = process.argv.slice(2);
    const queue = requested.length > 0 ? requested : [...DEFAULT_ITEMS];
    const seen = new Set<string>();
    const npm = new Set<string>();
    while (queue.length > 0) {
        const name = queue.shift();
        if (name === undefined || seen.has(name)) continue;
        seen.add(name);
        const item = await fetchItem(name);
        for (const dep of item.dependencies ?? []) npm.add(dep);
        queue.push(...(item.registryDependencies ?? []));
        for (const file of item.files) {
            const target = join(APP_ROOT, file.target.replace(/^~\//, ""));
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, withHeader(file, item));
        }
    }
    console.log(`vendored ${seen.size} items: ${[...seen].sort().join(", ")}`);
    console.log(`npm dependencies: ${[...npm].sort().join(", ")}`);
}

await main();
