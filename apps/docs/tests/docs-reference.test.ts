import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The API reference is written by hand, and this test keeps it honest.
//
// Why by hand: Fumadocs generates prop tables with fumadocs-typescript (`AutoTypeTable`), which
// drives the TypeScript compiler API to read the types. This repo pins TypeScript 7, the native
// (Go) compiler, which ships no JavaScript compiler API, so fumadocs-typescript cannot run. The
// tables live in content/docs/api/*.mdx instead, and the checks below fail when the sources and
// the pages drift apart:
//
// - every export of @fragiola/dockable-react (index.ts, and the parts in parts.ts) is on its
//   reference page;
// - every field of every exported props/state/result interface is a row of its page's tables;
// - the core pages cover every action creator, label key, JSON attribute and public method.
//
// Interfaces are read with regular expressions (fields are the 4-space-indented `name?:` lines
// of an `export interface … {` block), which is enough for this codebase's formatting (Biome).

const ROOT = join(import.meta.dirname, "../../..");
const REACT_SRC = join(ROOT, "packages/react/src");
const CORE_SRC = join(ROOT, "packages/core/src");
const API = join(import.meta.dirname, "../content/docs/api");

const read = (path: string) => readFileSync(path, "utf-8");
const page = (slug: string) => read(join(API, `${slug}.mdx`));

/** The reference page of each module of the React package. */
const MODULE_PAGES: Record<string, string> = {
    "./Root": "root",
    "./Row": "row",
    "./TabSet": "tabset",
    "./TabList": "tablist",
    "./Tab": "tab",
    "./TabSetContent": "tabset-content",
    "./Panels": "panels",
    "./Panel": "panel",
    "./Splitter": "splitter",
    "./DragSource": "drag-source",
    "./DropIndicator": "drop-indicator",
    "./DropZone": "drop-zone",
    "./Popout": "popout",
    "./hooks": "hooks",
    "./context": "hooks",
    "./utils/useRender": "root",
};

interface Export {
    name: string;
    module: string;
}

/** `export { a, type B } from "./x"` and `export type { … } from "./x"` statements. */
function namedExports(source: string): Export[] {
    const exports: Export[] = [];
    for (const match of source.matchAll(
        /export (?:type )?\{([^}]*)\} from "([^"]+)"/g,
    )) {
        const [, names = "", module = ""] = match;
        for (const raw of names.split(",")) {
            const name = raw
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)
                .pop();
            if (name) exports.push({ name, module });
        }
    }
    return exports;
}

/** The fields of `export interface <name> … { … }` in `source`, or undefined when absent. */
function interfaceFields(
    source: string,
    name: string,
): { fields: string[]; extendsNames: string[] } | undefined {
    const match = new RegExp(
        `export interface ${name}\\b([^{]*)\\{([\\s\\S]*?)\\n\\}`,
    ).exec(source);
    if (!match) return undefined;
    const [, heritage = "", body = ""] = match;
    const fields = [...body.matchAll(/^ {4}(?:readonly )?(\w+)\??:/gm)].map(
        (field) => field[1] ?? "",
    );
    const extendsNames = [...heritage.matchAll(/\b(I\w+)\b/g)].map(
        (base) => base[1] ?? "",
    );
    return { fields, extendsNames };
}

/** The first-cell names of every markdown table row: `` | `name(…)` | `` gives `name`. */
function tableRowNames(mdx: string): Set<string> {
    const names = new Set<string>();
    for (const match of mdx.matchAll(/^\| `([^`]+)`/gm)) {
        const cell = match[1] ?? "";
        names.add(cell.replace(/^Model\./, "").split(/[(<\s]/)[0] ?? cell);
    }
    // cells that list several names: | `a()`, `b()` |
    for (const match of mdx.matchAll(/^\|([^|\n]*)\|/gm)) {
        for (const code of (match[1] ?? "").matchAll(/`([^`]+)`/g)) {
            const cell = code[1] ?? "";
            names.add(cell.replace(/^Model\./, "").split(/[(<\s]/)[0] ?? cell);
        }
    }
    return names;
}

/** `name` appears in the page as code: `` `name` ``, `` `name<…>` ``, `` `name(…)` ``. */
function mentions(mdx: string, name: string): boolean {
    return new RegExp(`\`${name}[\`<(.]`).test(mdx);
}

const index = read(join(REACT_SRC, "index.ts"));
const parts = read(join(REACT_SRC, "parts.ts"));
const indexExports = namedExports(index);
const partExports = namedExports(parts);

function moduleSource(module: string): string {
    return read(join(REACT_SRC, `${module.replace(/^\.\//, "")}.tsx`));
}

function sourceOf(module: string): string {
    try {
        return moduleSource(module);
    } catch {
        return read(join(REACT_SRC, `${module.replace(/^\.\//, "")}.ts`));
    }
}

const CORE_FILES = [
    "splitter/SplitterController.ts",
    "dnd/DragDropManager.ts",
    "undo/UndoManager.ts",
];

/** Fields of an interface, following `extends` into the core for `I…` bases. */
function allFields(source: string, name: string): string[] {
    const found = interfaceFields(source, name);
    if (!found) return [];
    const inherited = found.extendsNames.flatMap((base) => {
        for (const file of CORE_FILES) {
            const core = read(join(CORE_SRC, file));
            if (interfaceFields(core, base)) return allFields(core, base);
        }
        return [];
    });
    return [...found.fields, ...inherited];
}

describe("the React reference", () => {
    it("has a page for every module the package exports from", () => {
        const modules = new Set(
            [...indexExports, ...partExports]
                .map((entry) => entry.module)
                .filter((module) => module !== "./parts"),
        );
        for (const module of modules) {
            expect(
                MODULE_PAGES,
                `no reference page for ${module}`,
            ).toHaveProperty(module);
        }
    });

    it("exports the Dockable namespace from parts.ts", () => {
        expect(index).toMatch(/export \* as Dockable from "\.\/parts"/);
    });

    it("documents every part as Dockable.<Part> on its own page", () => {
        expect(partExports.length).toBeGreaterThan(0);
        for (const { name, module } of partExports) {
            const slug = MODULE_PAGES[module];
            expect(slug, `no page for Dockable.${name}`).toBeDefined();
            expect(page(slug ?? ""), `api/${slug}.mdx`).toMatch(
                new RegExp(`^title: Dockable\\.${name}$`, "m"),
            );
        }
    });

    it("mentions every named export on its module's page", () => {
        for (const { name, module } of indexExports) {
            if (module === "./parts") continue;
            const slug = MODULE_PAGES[module] ?? "";
            expect(
                mentions(page(slug), name),
                `${name} on api/${slug}.mdx`,
            ).toBe(true);
        }
    });

    it("has a table row for every field of every exported interface", () => {
        let checked = 0;
        for (const { name, module } of indexExports) {
            if (module === "./parts") continue;
            const fields = allFields(sourceOf(module), name);
            const slug = MODULE_PAGES[module] ?? "";
            const rows = tableRowNames(page(slug));
            for (const field of fields) {
                checked++;
                expect(
                    rows.has(field),
                    `${name}.${field} has no row on api/${slug}.mdx`,
                ).toBe(true);
            }
        }
        // the parser found the interfaces (a formatting change must not silently pass)
        expect(checked).toBeGreaterThan(50);
    });

    it("has a table row for every prop of every primitive", () => {
        // each part's `<Part>Props` must exist and its fields be rows (covered above), and parts
        // built on DivPrimitiveProps link the common props
        for (const { name, module } of partExports) {
            const source = moduleSource(module);
            const slug = MODULE_PAGES[module] ?? "";
            const mdx = page(slug);
            expect(source, `${name}Props in ${module}`).toMatch(
                new RegExp(`export (interface|type) ${name}Props\\b`),
            );
            for (const field of allFields(source, `${name}Props`)) {
                expect(tableRowNames(mdx).has(field), `${name}.${field}`).toBe(
                    true,
                );
            }
            if (/DivPrimitiveProps/.test(source) && slug !== "root") {
                expect(mdx, `api/${slug}.mdx links the common props`).toContain(
                    "/docs/api/root#common-props",
                );
            }
        }
        const common = allFields(
            read(join(REACT_SRC, "utils/useRender.ts")),
            "PrimitiveProps",
        );
        expect(common).toEqual(["render", "className", "style", "ref"]);
    });

    it("gives every primitive page its data-layout-path", () => {
        for (const { module } of partExports) {
            const slug = MODULE_PAGES[module] ?? "";
            if (slug === "panels") continue; // renders no element
            // lives outside any layout: its page says it has no layout path
            if (slug === "drag-source" || slug === "drop-zone") continue;
            expect(page(slug), `api/${slug}.mdx`).toContain(
                "`data-layout-path`",
            );
        }
    });
});

describe("the core reference", () => {
    it("lists every action creator and type constant", () => {
        const source = read(join(CORE_SRC, "model/Actions.ts"));
        const actions = source.slice(
            source.indexOf("export class Actions"),
            source.indexOf("export class Action {"),
        );
        const creators = [...actions.matchAll(/static (\w+)\(/g)].map(
            (match) => match[1] ?? "",
        );
        const constants = [...actions.matchAll(/static (\w+) = "/g)].map(
            (match) => match[1] ?? "",
        );
        expect(creators.length).toBeGreaterThan(20);
        const mdx = page("actions");
        const rows = tableRowNames(mdx);
        for (const creator of creators) {
            expect(rows.has(creator), `Actions.${creator}`).toBe(true);
        }
        for (const constant of constants) {
            expect(mentions(mdx, constant), `Actions.${constant}`).toBe(true);
        }
    });

    it("lists every DockableLabel key with its value", () => {
        const source = read(join(CORE_SRC, "labels/DockableLabel.ts"));
        const keys = [...source.matchAll(/^ {4}(\w+) = "([^"]+)",/gm)];
        expect(keys.length).toBeGreaterThan(40);
        const mdx = page("labels");
        for (const [, key = "", value = ""] of keys) {
            expect(mdx, key).toContain(`| \`${key}\` | \`"${value}"\` |`);
        }
    });

    it("lists every JSON attribute of the global, row, tabset, tab and sub-layout nodes", () => {
        const source = read(join(CORE_SRC, "model/IJsonModel.ts"));
        const rows = tableRowNames(page("json-model"));
        for (const name of [
            "IGlobalAttributes",
            "IRowAttributes",
            "ITabSetAttributes",
            "ITabAttributes",
            "ISubLayoutAttributes",
        ]) {
            const fields = interfaceFields(source, name)?.fields ?? [];
            expect(fields.length, name).toBeGreaterThan(0);
            for (const field of fields) {
                expect(rows.has(field), `${name}.${field}`).toBe(true);
            }
        }
    });

    it.each([
        ["engine/LayoutEngine.ts", "LayoutEngine", "layout-engine"],
        ["model/Model.ts", "Model", "model"],
        ["undo/UndoManager.ts", "UndoManager", "undo-manager"],
    ])("documents every public method of %s", (file, name, slug) => {
        const source = read(join(CORE_SRC, file));
        const start = source.indexOf(`export class ${name}`);
        const body = source.slice(start, source.indexOf("\n}\n", start));
        const methods = new Set<string>();
        for (const match of body.matchAll(
            /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?\n {4}(?:static |get )?(?!private\b|protected\b|constructor\b)([a-zA-Z]\w*)(?:\s*=\s*\(|\()/g,
        )) {
            if (match[1]?.includes("@internal")) continue;
            methods.add(match[2] ?? "");
        }
        expect(methods.size).toBeGreaterThan(5);
        const mdx = page(slug);
        const rows = tableRowNames(mdx);
        for (const method of methods) {
            expect(
                rows.has(method) || mentions(mdx, method),
                `${name}.${method} on api/${slug}.mdx`,
            ).toBe(true);
        }
    });

    it("lists every UndoManager option and snapshot field", () => {
        const source = read(join(CORE_SRC, "undo/UndoManager.ts"));
        const rows = tableRowNames(page("undo-manager"));
        for (const name of ["IUndoOptions", "IUndoSnapshot"]) {
            for (const field of interfaceFields(source, name)?.fields ?? []) {
                expect(rows.has(field), `${name}.${field}`).toBe(true);
            }
        }
    });
});
