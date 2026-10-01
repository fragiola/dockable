import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The API reference is written by hand, and this test keeps it honest.
//
// Why by hand: Fumadocs generates prop tables with fumadocs-typescript (`AutoTypeTable`), which
// drives the TypeScript compiler API to read the types. This repo pins TypeScript 7, the native
// (Go) compiler, which ships no JavaScript compiler API, so fumadocs-typescript cannot run. The
// tables live in site/docs/api/*.mdx instead, and the checks below fail when the sources and
// the pages drift apart:
//
// - every export of @fragiola/dockable-react (index.ts, and the parts in parts.ts) is on its
//   reference page;
// - every field of every exported props/state/result interface is a row of its page's tables;
// - the core pages cover every command (with every payload and result field, taken from the
//   registry itself), every error code, every export of the core, every field of the node and
//   layout JSON types, every label key and every public method of the model and the engine.
//
// Interfaces are read with regular expressions (fields are the 4-space-indented `name?:` lines
// of an `export interface … {` block), which is enough for this codebase's formatting (Biome).

const ROOT = join(import.meta.dirname, "../..");
const REACT_SRC = join(ROOT, "packages/react/src");
const CORE_SRC = join(ROOT, "packages/core/src");
const API = join(import.meta.dirname, "../docs/api");

const read = (path: string) => readFileSync(path, "utf-8");

/** What the test reads of a command in the core's registry. */
interface CommandInfo {
    name: string;
    payloadSchema: { properties?: Record<string, unknown> };
    resultSchema: { properties?: Record<string, unknown> };
}

// the core's registry, loaded at run time from its source: a computed path keeps the site's
// typecheck from checking the core too (it has its own)
const core = (await import(join(CORE_SRC, "index.ts"))) as {
    createModel(): { get(key: "commands"): readonly CommandInfo[] };
};
const page = (slug: string) => read(join(API, `${slug}.mdx`));

// the keys of the model's and the engine's verbs, from their registries
const queries = (await import(join(CORE_SRC, "state/queries.ts"))) as {
    MODEL_GET_KEYS: readonly string[];
    MODEL_IS_KEYS: readonly string[];
};
const verbs = (await import(join(CORE_SRC, "engine/verbs.ts"))) as {
    ENGINE_ACTION_KEYS: readonly string[];
    ENGINE_GET_KEYS: readonly string[];
    ENGINE_IS_KEYS: readonly string[];
};

/** `key` appears in the page as a quoted key in code: `` `"selected-tab-by"` ``. */
function mentionsKey(mdx: string, key: string): boolean {
    return mdx.includes(`\`"${key}"\``);
}

/** The reference page of each module of the React package. */
const MODULE_PAGES: Record<string, string> = {
    "./Root": "root",
    "./Row": "row",
    "./TabSet": "tabset",
    "./TabList": "tablist",
    "./TabOverflowTrigger": "tab-overflow-trigger",
    "./Tab": "tab",
    "./TabSetContent": "tabset-content",
    "./Panels": "panels",
    "./Panel": "panel",
    "./Splitter": "splitter",
    "./Borders": "borders",
    "./Border": "border",
    "./BorderContent": "border-content",
    "./EdgeIndicator": "edge-indicator",
    "./DragGroup": "drag-group",
    "./DragSource": "drag-source",
    "./DropIndicator": "drop-indicator",
    "./DropZone": "drop-zone",
    "./Popout": "popout",
    "./PopoutTrigger": "popout-trigger",
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

/**
 * The fields of `export interface <name> … { … }` (or of `export type <name> … = { … }`) in
 * `source`, or undefined when absent. `extendsNames` are the names in its heritage clause.
 */
function interfaceFields(
    source: string,
    name: string,
): { fields: string[]; extendsNames: string[] } | undefined {
    const declared = new RegExp(
        `export interface ${name}\\b([^{]*)\\{([\\s\\S]*?)\\n\\}`,
    ).exec(source);
    const aliased = new RegExp(
        `export type ${name}\\b(?:<[^>]*>)?\\s*= \\{([\\s\\S]*?)\\n\\}`,
    ).exec(source);
    if (!declared && !aliased) return undefined;
    const heritage = declared?.[1] ?? "";
    const body = (declared ? declared[2] : aliased?.[1]) ?? "";
    const fields = [...body.matchAll(/^ {4}(?:readonly )?(\w+)\??:/gm)].map(
        (field) => field[1] ?? "",
    );
    // the bases after `extends`: not the type parameters (`<T extends …>`), not type arguments
    const bases = heritage
        .replace(/^\s*<[^>]*>/, "")
        .replace(/<[^>]*>/g, "")
        .replace(/^\s*extends\b/, "");
    const extendsNames = [...bases.matchAll(/\b([A-Z]\w*)\b/g)].map(
        (base) => base[1] ?? "",
    );
    return { fields, extendsNames };
}

/** `import { type A as B }` aliases of a source: alias → original name. */
function importAliases(source: string): Map<string, string> {
    const aliases = new Map<string, string>();
    for (const match of source.matchAll(/(?:type )?(\w+) as (\w+)/g)) {
        aliases.set(match[2] ?? "", match[1] ?? "");
    }
    return aliases;
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
    "state/types.ts",
];

/** Fields of an interface, following `extends` into the core for bases it declares. */
function allFields(source: string, name: string): string[] {
    const found = interfaceFields(source, name);
    if (!found) return [];
    const aliases = importAliases(source);
    const inherited = found.extendsNames.flatMap((base) => {
        const original = aliases.get(base) ?? base;
        for (const file of CORE_FILES) {
            const core = read(join(CORE_SRC, file));
            if (interfaceFields(core, original)) {
                return allFields(core, original);
            }
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
            if (slug === "panels" || slug === "drag-group") continue; // renders no element
            // lives outside any layout: its page says it has no layout path
            if (slug === "drag-source" || slug === "drop-zone") continue;
            expect(page(slug), `api/${slug}.mdx`).toContain(
                "`data-layout-path`",
            );
        }
    });
});

describe("the core reference", () => {
    const commands = core.createModel().get("commands");
    const commandsPage = page("commands");

    /** The part of the commands page about one command: from its `###` to the next heading. */
    function commandSection(name: string): string {
        const heading = `### \`${name}\``;
        const start = commandsPage.indexOf(heading);
        if (start < 0) return "";
        const rest = commandsPage.slice(start + heading.length);
        const end = rest.search(/^#{2,3} /m);
        return end < 0 ? rest : rest.slice(0, end);
    }

    it("has a section for every command of the registry, with every payload and result field", () => {
        expect(commands.length).toBeGreaterThan(20);
        // the registry is the one the model runs: the source names the same commands
        const sources = ["tab", "tabset", "row", "border", "window", "layout"]
            .map((file) => read(join(CORE_SRC, `commands/${file}.ts`)))
            .join("\n");
        const declared = [...sources.matchAll(/^ {4}name: "([\w.]+)",/gm)].map(
            (match) => match[1],
        );
        expect(new Set(commands.map((info) => info.name))).toEqual(
            new Set(declared),
        );
        for (const info of commands) {
            const section = commandSection(info.name);
            expect(
                section,
                `### \`${info.name}\` on api/commands.mdx`,
            ).not.toBe("");
            const rows = tableRowNames(section);
            for (const schema of [info.payloadSchema, info.resultSchema]) {
                for (const field of Object.keys(schema.properties ?? {})) {
                    expect(rows.has(field), `${info.name}.${field}`).toBe(true);
                }
            }
            expect(section, `${info.name}: a model.run example`).toContain(
                `model.run("${info.name}"`,
            );
            expect(section, `${info.name}: its errors`).toContain("**Errors**");
        }
    });

    it("documents the command bus and every error code", () => {
        const mdx = page("command-bus");
        for (const method of [
            "run",
            "dispatch",
            "can",
            "check",
            "use",
            "subscribe",
            "get",
        ]) {
            expect(mentions(mdx, method), `model.${method}`).toBe(true);
        }
        expect(mdx).toContain("`batch`");
        expect(mdx).toContain('model.get("commands")');
        const source = read(join(CORE_SRC, "commands/types.ts"));
        const union =
            /export type CommandErrorCode =([^;]+);/.exec(source)?.[1] ?? "";
        const codes = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "");
        expect(codes.length).toBeGreaterThan(5);
        for (const code of codes) {
            expect(mdx, `error code ${code}`).toContain(`\`${code}\``);
        }
    });

    it("mentions every export of the core on an API page", () => {
        const index = read(join(CORE_SRC, "index.ts"));
        const names = namedExports(index).map((entry) => entry.name);
        // `export * from "./x"`: every declaration the module exports
        for (const match of index.matchAll(/export \* from "\.\/([^"]+)"/g)) {
            const module = read(join(CORE_SRC, `${match[1]}.ts`));
            for (const declaration of module.matchAll(
                /^export (?:declare )?(?:const|function|class|interface|type|enum) (\w+)/gm,
            )) {
                names.push(declaration[1] ?? "");
            }
        }
        expect(names.length).toBeGreaterThan(100);
        const pages = readdirSync(API)
            .filter((file) => file.endsWith(".mdx"))
            .map((file) => read(join(API, file)));
        const missing = names.filter(
            (name) => !pages.some((mdx) => mentions(mdx, name)),
        );
        expect(missing, "exports no API page mentions").toEqual([]);
    });

    it("has a table row for every field of the node and layout JSON types", () => {
        const types = read(join(CORE_SRC, "state/types.ts"));
        const json = read(join(CORE_SRC, "state/json.ts"));
        const rows = tableRowNames(page("json-model"));
        let checked = 0;
        for (const [source, names] of [
            [
                types,
                [
                    "SizeLimits",
                    "TabNode",
                    "TabsetNode",
                    "RowNode",
                    "BorderNode",
                    "WindowLayout",
                    "LayoutSettings",
                    "TabDefaults",
                    "TabsetDefaults",
                    "BorderDefaults",
                    "LayoutDefaults",
                    "LayoutState",
                ],
            ],
            [
                json,
                [
                    "TabInit",
                    "TabsetJson",
                    "RowJson",
                    "BorderJson",
                    "WindowJson",
                    "LayoutJson",
                ],
            ],
        ] as const) {
            for (const name of names) {
                const fields = interfaceFields(source, name)?.fields ?? [];
                expect(fields.length, name).toBeGreaterThan(0);
                for (const field of fields) {
                    checked++;
                    expect(rows.has(field), `${name}.${field}`).toBe(true);
                }
            }
        }
        expect(checked).toBeGreaterThan(60);
    });

    it("documents every member of the engine, and every member of its adapter", () => {
        const source = read(join(CORE_SRC, "engine/LayoutEngine.ts"));
        const start = source.indexOf("export class LayoutEngine");
        const body = source.slice(start, source.indexOf("\n}\n", start));
        // the public members: everything not private (TypeScript private, or `#`)
        const members = new Set<string>();
        for (const match of body.matchAll(
            /\n {4}(?:readonly |get )?(?!private\b|protected\b|constructor\b)([a-zA-Z]\w*)[<(:=?]/g,
        )) {
            members.add(match[1] ?? "");
        }
        expect([...members].sort()).toEqual(
            ["adapter", "can", "check", "get", "is", "layoutId", "run"].sort(),
        );
        const adapterStart = source.indexOf(
            "export interface LayoutEngineAdapter",
        );
        const adapterBody = source.slice(
            adapterStart,
            source.indexOf("\n}\n", adapterStart),
        );
        const adapterMembers = [
            ...adapterBody.matchAll(/^ {4}(?:readonly )?(\w+)[<(:]/gm),
        ].map((match) => match[1] ?? "");
        expect(adapterMembers.length).toBeGreaterThan(30);
        const mdx = page("layout-engine");
        const rows = tableRowNames(mdx);
        for (const member of [...members, ...adapterMembers]) {
            expect(
                rows.has(member) || mentions(mdx, member),
                `LayoutEngine.${member} on api/layout-engine.mdx`,
            ).toBe(true);
        }
    });

    it("lists every key of the engine's run, get and is", () => {
        const mdx = page("layout-engine");
        const keys = [
            ...verbs.ENGINE_ACTION_KEYS,
            ...verbs.ENGINE_GET_KEYS,
            ...verbs.ENGINE_IS_KEYS,
        ];
        expect(keys.length).toBeGreaterThan(10);
        for (const key of keys) {
            expect(
                mentionsKey(mdx, key),
                `"${key}" on api/layout-engine.mdx`,
            ).toBe(true);
        }
    });

    it("lists every key of the model's get and is", () => {
        const mdx = page("model");
        const keys = [...queries.MODEL_GET_KEYS, ...queries.MODEL_IS_KEYS];
        expect(keys.length).toBeGreaterThan(20);
        for (const key of keys) {
            expect(mentionsKey(mdx, key), `"${key}" on api/model.mdx`).toBe(
                true,
            );
        }
    });

    it("documents every method of the Model interface", () => {
        const source = read(join(CORE_SRC, "state/model.ts"));
        const start = source.indexOf("export interface Model<");
        const body = source.slice(start, source.indexOf("\n}\n", start));
        const members = new Set(
            [...body.matchAll(/^ {4}(?:readonly )?(\w+)[<(:]/gm)].map(
                (match) => match[1] ?? "",
            ),
        );
        expect([...members].sort()).toEqual(
            [
                "can",
                "check",
                "dispatch",
                "get",
                "is",
                "run",
                "state",
                "subscribe",
                "use",
            ].sort(),
        );
        const mdx = page("model") + page("command-bus");
        const rows = tableRowNames(mdx);
        for (const member of members) {
            expect(
                rows.has(member) || mentions(mdx, member),
                `Model.${member} on api/model.mdx or api/command-bus.mdx`,
            ).toBe(true);
        }
    });
});
