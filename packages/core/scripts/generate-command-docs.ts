// Writes site/docs/api/commands.mdx from the command registry, so the reference cannot drift from
// the code: each command's description, payload and result tables (from its JSON Schemas and its
// TypeScript types in `CommandMap`), the errors it can return, and how to run it from code and
// as JSON. With `--check`, fails instead when the committed page differs.
//
// It reads the built package (`dist/index.js`, `pnpm --filter @fragiola/dockable build`) and the
// `CommandMap` source for the type names.
//
//   node packages/core/scripts/generate-command-docs.ts [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface JsonSchema {
    readonly $ref?: string;
    readonly $defs?: Record<string, JsonSchema>;
    readonly description?: string;
    readonly type?: string;
    readonly properties?: Record<string, JsonSchema>;
    readonly required?: readonly string[];
    readonly enum?: readonly unknown[];
    readonly const?: unknown;
    readonly items?: JsonSchema;
    readonly anyOf?: readonly JsonSchema[];
    readonly oneOf?: readonly JsonSchema[];
}

interface CommandInfo {
    readonly name: string;
    readonly description: string;
    readonly payloadSchema: JsonSchema;
    readonly resultSchema: JsonSchema;
    readonly transient: boolean;
}

interface Core {
    createModel(json?: unknown): {
        commands(): readonly CommandInfo[];
        dispatch(input: unknown): {
            ok: boolean;
            error?: { code: string; message: string; path?: string };
        };
    };
}

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../..");
const OUT = join(ROOT, "site/docs/api/commands.mdx");
const COMMAND_TYPES = join(here, "../src/commands/types.ts");
const COMMAND_SOURCES = [
    "tab",
    "tabset",
    "row",
    "border",
    "window",
    "layout",
    "rules",
    "dock",
].map((file) => join(here, `../src/commands/${file}.ts`));

/** The error codes a command's own rules return (the ones every command can return aside). */
const RULE_CODES = ["not_found", "refused"] as const;

/** The sections of the page, by command prefix. */
const GROUPS: readonly [prefix: string, title: string][] = [
    ["tab", "Tabs"],
    ["tabset", "Tabsets"],
    ["row", "Rows"],
    ["border", "Borders"],
    ["window", "Windows"],
    ["layout", "The layout"],
    ["batch", "Batches"],
];

/** Every command's example payload: what the reference shows (checked against its schema). */
const EXAMPLES: Record<string, unknown> = {
    "tab.add": {
        component: "editor",
        data: { name: "a.ts", path: "/a.ts" },
        to: "tabset-1",
    },
    "tab.select": { tab: "tab-1" },
    "tab.close": { tab: "tab-1" },
    "tab.move": { tab: "tab-1", to: "tabset-2", location: "right" },
    "tab.update": {
        tab: "tab-1",
        component: "editor",
        data: { name: "b.ts", path: "/b.ts" },
    },
    "tab.pin": { tab: "tab-1", value: true },
    "tab.popout": { tab: "tab-1" },
    "tab.configure": { tab: "tab-1", enableClose: false },
    "tabset.activate": { tabset: "tabset-1" },
    "tabset.maximize": { tabset: "tabset-1", value: true },
    "tabset.close": { tabset: "tabset-1" },
    "tabset.move": { tabset: "tabset-1", to: "main", location: "bottom" },
    "tabset.popout": { tabset: "tabset-1" },
    "tabset.configure": { tabset: "tabset-1", enableMaximize: false },
    "row.resize": { row: "row-1", weights: [30, 70] },
    "row.configure": { row: "row-1", data: { name: "Editors" } },
    "border.resize": { border: "border_left", size: 240 },
    "border.configure": { border: "border_left", open: true },
    "window.close": { window: "window-1" },
    "window.configure": {
        window: "window-1",
        rect: { x: 100, y: 80, width: 800, height: 600 },
    },
    "layout.configure": { defaults: { tab: { enableClose: false } } },
    "layout.load": {
        layout: {
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "editor", data: { name: "a.ts" } },
                        ],
                    },
                ],
            },
        },
    },
    batch: {
        commands: [
            { command: "tab.close", payload: { tab: "tab-1" } },
            { command: "tab.close", payload: { tab: "tab-2" } },
        ],
    },
};

/** A short type for a schema: `string`, `integer`, `"center" \| "top"`, `tab[]`, … */
function typeOf(schema: JsonSchema): string {
    if (schema.$ref) {
        return schema.$ref.replace("#/$defs/", "");
    }
    if (schema.const !== undefined) {
        return JSON.stringify(schema.const);
    }
    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    }
    const alternatives = schema.anyOf ?? schema.oneOf;
    if (alternatives) {
        return [...new Set(alternatives.map(typeOf))].join(" | ");
    }
    if (schema.type === "array") {
        return `${schema.items ? typeOf(schema.items) : "unknown"}[]`;
    }
    if (schema.type === "object" && !schema.properties) {
        return "object";
    }
    return schema.type ?? "JSON";
}

/**
 * Prose from a schema or a description, safe in MDX: a token with `<`, `>`, `{` or `}` (MDX reads
 * them as JSX) goes into a code span, unless it is in one already.
 */
function prose(text: string): string {
    return text
        .split(/(`[^`]*`)/)
        .map((part, i) =>
            i % 2 === 1
                ? part
                : part.replace(/[^\s`]*[<>{}][^\s`]*/g, (token) => {
                      const [, leading = "", core = token, trailing = ""] =
                          /^([("']*)(.*?)([.,;:)"']*)$/.exec(token) ?? [];
                      return `${leading}\`${core}\`${trailing}`;
                  }),
        )
        .join("");
}

/** A Markdown table cell: pipes escaped, one line. */
function cell(text: string): string {
    return text.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function fieldTable(schema: JsonSchema): string {
    const properties = Object.entries(schema.properties ?? {});
    if (properties.length === 0) {
        return "No fields.";
    }
    const required = new Set(schema.required ?? []);
    const rows = properties.map(
        ([name, field]) =>
            `| \`${name}\` | \`${cell(typeOf(field))}\` | ${required.has(name) ? "yes" : "no"} | ${cell(prose(field.description ?? ""))} |`,
    );
    return [
        "| field | type | required | description |",
        "| --- | --- | --- | --- |",
        ...rows,
    ].join("\n");
}

/** `CommandMap`'s entries: each command's payload and result types, as written in the source. */
function commandTypes(): Map<string, { payload: string; result: string }> {
    const source = readFileSync(COMMAND_TYPES, "utf8");
    const start = source.indexOf("export interface CommandMap");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    const types = new Map<string, { payload: string; result: string }>();
    for (const match of body.matchAll(/^ {4}"?([\w.]+)"?: \{/gm)) {
        const name = match[1] ?? "";
        // the entry's braces, balanced
        let depth = 0;
        let end = (match.index ?? 0) + match[0].length - 1;
        for (; end < body.length; end++) {
            if (body[end] === "{") depth++;
            if (body[end] === "}" && --depth === 0) break;
        }
        const entry = body
            .slice((match.index ?? 0) + match[0].length, end)
            .replace(/\s+/g, " ");
        const part = (key: string) => {
            const from = entry.indexOf(`${key}:`) + key.length + 1;
            let level = 0;
            let i = from;
            for (; i < entry.length; i++) {
                const char = entry[i];
                if (char === "{" || char === "<" || char === "(") level++;
                if (char === "}" || char === ">" || char === ")") level--;
                if (char === ";" && level === 0) break;
            }
            return entry.slice(from, i).trim();
        };
        types.set(name, { payload: part("payload"), result: part("result") });
    }
    return types;
}

/** A value as a JavaScript literal: JSON with unquoted keys. */
function literal(value: unknown): string {
    return JSON.stringify(value, null, 4).replace(/"(\w+)":/g, "$1:");
}

/**
 * Each command's rule errors, read from the source: the codes its reducer returns, and those of
 * the helper functions it calls (followed through the helpers they call in turn).
 */
function commandCodes(): Map<string, Set<string>> {
    const sources = COMMAND_SOURCES.map((file) => readFileSync(file, "utf8"));
    const codesIn = (text: string): Set<string> =>
        new Set(RULE_CODES.filter((code) => text.includes(`"${code}"`)));
    // the helpers: every top-level function of the command files
    const helpers = new Map<string, string>();
    for (const source of sources) {
        for (const match of source.matchAll(
            /^(?:export )?function (\w+)[^{]*\{([\s\S]*?)\n\}\n/gm,
        )) {
            helpers.set(match[1] ?? "", match[2] ?? "");
        }
    }
    const closure = (text: string, seen = new Set<string>()): Set<string> => {
        const codes = codesIn(text);
        for (const call of text.matchAll(/\b(\w+)\(/g)) {
            const name = call[1] ?? "";
            const body = helpers.get(name);
            if (body !== undefined && !seen.has(name)) {
                seen.add(name);
                for (const code of closure(body, seen)) codes.add(code);
            }
        }
        return codes;
    };
    const result = new Map<string, Set<string>>();
    for (const source of sources) {
        const blocks = source
            .split(/^export const \w+ = defineCommand\(/m)
            .slice(1);
        for (const block of blocks) {
            const name = /name: "([\w.]+)"/.exec(block)?.[1];
            if (name) result.set(name, closure(block));
        }
    }
    return result;
}

function errorLine(name: string, codes: Set<string> | undefined): string {
    if (name === "batch") {
        return "**Errors**: those of the commands it runs (the first failure, at its path in `commands`); nothing applies unless all succeed.";
    }
    const own = RULE_CODES.filter((code) => codes?.has(code)).map(
        (code) => `\`${code}\``,
    );
    return own.length === 0
        ? "**Errors**: only those every command can return."
        : `**Errors**: ${own.join(", ")}, besides those every command can return.`;
}

function section(
    info: CommandInfo,
    types: { payload: string; result: string } | undefined,
    codes: Set<string> | undefined,
): string {
    const example = EXAMPLES[info.name];
    const payload = literal(example);
    const inline = JSON.stringify(example);
    return [
        `### \`${info.name}\``,
        "",
        prose(info.description),
        "",
        info.transient
            ? "It may run as a step of a continuous gesture: `model.run(…, { transient: true })`."
            : "",
        "",
        `**Payload**${types ? ` (\`${cell(types.payload)}\`)` : ""}`,
        "",
        fieldTable(info.payloadSchema),
        "",
        `**Result**${types ? ` (\`${cell(types.result)}\`)` : ""}`,
        "",
        fieldTable(info.resultSchema),
        "",
        errorLine(info.name, codes),
        "",
        "```ts",
        `model.run("${info.name}", ${payload});`,
        "```",
        "",
        "```json",
        `{ "command": "${info.name}", "payload": ${inline} }`,
        "```",
    ]
        .filter((line, i, lines) => !(line === "" && lines[i - 1] === ""))
        .join("\n");
}

async function render(): Promise<string> {
    const core = (await import(
        join(here, "../dist/index.js")
    )) as unknown as Core;
    // a model with none of the examples' ids: only their shape is checked (not_found is fine)
    const model = core.createModel({
        version: 1,
        root: { type: "row", id: "x-row", children: [] },
    });
    const commands = model.commands();
    const types = commandTypes();
    const codes = commandCodes();

    // every example is a valid payload (a missing node is fine: the reference invents ids)
    for (const info of commands) {
        if (!(info.name in EXAMPLES)) {
            throw new Error(`no example payload for ${info.name}`);
        }
        const result = model.dispatch({
            command: info.name,
            payload: EXAMPLES[info.name],
        });
        if (result.error?.code === "invalid_payload") {
            throw new Error(
                `the example of ${info.name} is invalid: ${result.error.message} at ${result.error.path}`,
            );
        }
        if (!types.has(info.name)) {
            throw new Error(`${info.name} is not in CommandMap`);
        }
        if (info.name !== "batch" && !codes.has(info.name)) {
            throw new Error(
                `${info.name}: its definition was not found in the sources`,
            );
        }
        for (const schema of [info.payloadSchema, info.resultSchema]) {
            for (const [field, property] of Object.entries(
                schema.properties ?? {},
            )) {
                if (!property.description) {
                    throw new Error(
                        `${info.name}: the field "${field}" has no description in its schema`,
                    );
                }
            }
        }
    }

    const grouped = GROUPS.map(([prefix, title]) => {
        const members = commands.filter(
            (info) =>
                info.name === prefix || info.name.startsWith(`${prefix}.`),
        );
        return [
            `## ${title}`,
            ...members.map((info) =>
                section(info, types.get(info.name), codes.get(info.name)),
            ),
        ].join("\n\n");
    });
    const listed = GROUPS.reduce(
        (count, [prefix]) =>
            count +
            commands.filter(
                (info) =>
                    info.name === prefix || info.name.startsWith(`${prefix}.`),
            ).length,
        0,
    );
    if (listed !== commands.length) {
        throw new Error("a command belongs to no section of the page");
    }

    return `${[
        "---",
        "title: Commands",
        "description: Every command the model runs, with its payload and result types and how to run it from code or as JSON. Generated from the registry.",
        "---",
        "",
        "{/* Generated by packages/core/scripts/generate-command-docs.ts from the command registry: do not edit. */}",
        "",
        `The model runs ${commands.length} commands. Each one takes a JSON payload, checked against its JSON Schema, and returns a \`CommandResult\`: \`{ ok: true, value }\`, or \`{ ok: false, error }\`. Run one with \`model.run(name, payload)\` (typed by your registry), or give it as untrusted JSON to \`model.dispatch({ command, payload })\`, which validates it first. \`model.commands()\` returns this same list with the schemas, ready to become tool definitions for an assistant.`,
        "",
        "Every command can return `invalid_payload` (the payload does not match its schema, with the path of each problem), `vetoed` (a middleware refused it), `queued` (a middleware ran it while another command was running) and `middleware_error`; each command lists the ones its own rules add: `not_found` (a node it names is missing) and `refused` (a rule of the layout refuses the change). See [the command bus](/docs/api/command-bus) for the results, the middleware and the events.",
        "",
        "The payload types below use `T`, your registry (see [typed data](/docs/concepts/typed-data)): a tab's `data` is checked against its `component`.",
        "",
        grouped.join("\n\n"),
    ].join("\n")}\n`;
}

const check = process.argv.includes("--check");
const output = await render();
if (check) {
    let current = "";
    try {
        current = readFileSync(OUT, "utf8");
    } catch {
        // missing: differs
    }
    if (current !== output) {
        console.error(
            "site/docs/api/commands.mdx is out of date: run node packages/core/scripts/generate-command-docs.ts",
        );
        process.exit(1);
    }
} else {
    writeFileSync(OUT, output);
}
