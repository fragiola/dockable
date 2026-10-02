// Fails when a package cannot be published as it is. Run by `pnpm check:package`, after the
// packages built. Each package is packed with pnpm, which applies `publishConfig` as the publish
// does (npm would not: the packages are only ever packed and published through pnpm), then:
//
// - its packed `exports` (from `publishConfig.exports`) are the repo's `exports` without the source
//   condition, and use only the `types`, `import` and `default` conditions, with targets in `dist`;
// - the React package depends on the core at its exact version;
// - publint (strict) and attw (`esm-only` profile) pass on the tarball;
// - the smoke test: a scratch Vite + React app outside the workspace installs the React tarball
//   (the core tarball comes as its dependency) and imports everything from it, typechecks with the
//   repo's TypeScript, builds, and its dev server serves the entry with every import resolved.
//   A consumer's dev server adds
//   the `development` condition, which once pointed the published `exports` at sources that are
//   not in the tarball.
import { execFileSync, spawn } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SOURCE_CONDITION } from "./source-condition.ts";

const root = join(import.meta.dirname, "..");

/** The only conditions a published `exports` may use: ESM, with its types. */
const PUBLISHED_CONDITIONS = ["types", "import", "default"];

/**
 * What is wrong with published `exports`: a condition other than `types`, `import` and `default`
 * (a source condition, `development`, …), or a target outside `dist`.
 */
export function exportProblems(exports: unknown, path = "exports"): string[] {
    if (typeof exports === "string") {
        return exports.startsWith("./dist/") || exports === "./package.json"
            ? []
            : [`${path}: "${exports}" is not in dist`];
    }
    if (exports === null || typeof exports !== "object") {
        return [`${path}: not a string or an object`];
    }
    return Object.entries(exports).flatMap(([key, value]) => [
        ...(key.startsWith(".") || PUBLISHED_CONDITIONS.includes(key)
            ? []
            : [`${path}: the "${key}" condition is published`]),
        ...exportProblems(value, `${path}["${key}"]`),
    ]);
}

/** `exports` without the source condition, at any depth (key order kept: it is the priority). */
export function withoutSource(exports: unknown): unknown {
    if (exports === null || typeof exports !== "object") return exports;
    return Object.fromEntries(
        Object.entries(exports)
            .filter(([key]) => key !== SOURCE_CONDITION)
            .map(([key, value]) => [key, withoutSource(value)]),
    );
}

/**
 * Whether the published `exports` (`publishConfig.exports`, a hand-written copy) are the repo's
 * `exports` without the source condition: the same subpaths, conditions, order and targets.
 */
export function publishedExportsProblems(
    exports: unknown,
    published: unknown,
): string[] {
    const expected = JSON.stringify(withoutSource(exports));
    const actual = JSON.stringify(published);
    return expected === actual
        ? []
        : [`published exports ${actual} are not the exports ${expected}`];
}

function run(command: string, args: string[], cwd: string): void {
    execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** `pnpm pack` of `packages/<name>` into `dir`; returns the tarball's path. */
function pack(name: string, dir: string): string {
    const output = execFileSync(
        "pnpm",
        ["pack", "--pack-destination", dir, "--json"],
        { cwd: join(root, "packages", name), encoding: "utf8" },
    );
    const { filename } = JSON.parse(output) as { filename: string };
    return filename;
}

interface PackedManifest {
    name: string;
    version: string;
    exports?: unknown;
    dependencies?: Record<string, string>;
}

function packedManifest(tarball: string): PackedManifest {
    return JSON.parse(
        execFileSync("tar", ["-xOzf", tarball, "package/package.json"], {
            encoding: "utf8",
        }),
    );
}

/** The `exports` of `packages/<name>/package.json`, the source condition included. */
function repoExports(name: string): unknown {
    const manifest = JSON.parse(
        readFileSync(join(root, "packages", name, "package.json"), "utf8"),
    ) as { exports?: unknown };
    return manifest.exports;
}

function lint(name: string, tarball: string): string[] {
    const manifest = packedManifest(tarball);
    const problems = [
        ...exportProblems(manifest.exports),
        ...publishedExportsProblems(repoExports(name), manifest.exports),
    ].map((problem) => `${manifest.name}: ${problem}`);
    run("pnpm", ["exec", "publint", tarball, "--strict"], root);
    run("pnpm", ["exec", "attw", tarball, "--profile", "esm-only"], root);
    return problems;
}

/** The versions the examples app pins, so the smoke app installs nothing new. */
function examplesVersion(name: string): string {
    const manifest = JSON.parse(
        readFileSync(join(root, "examples/react/package.json"), "utf8"),
    ) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
    };
    const version =
        manifest.dependencies[name] ?? manifest.devDependencies[name];
    if (version === undefined) {
        throw new Error(`examples/react does not depend on ${name}`);
    }
    return version;
}

// Everything from the React package, the core included: a React app installs that one only.
const SMOKE_MAIN = `import {
    createModel,
    Dockable,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

type Types = { tabs: { note: undefined } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            { type: "tabset", children: [{ component: "note", label: "One" }] },
            { type: "tabset", children: [{ component: "note", label: "Two" }] },
        ],
    },
};

const model: Model<Types> = createModel<Types>(json);

function label(tab: TabOf<Types>): string {
    return tab.label;
}

function renderNode(child: TabsetNode<Types> | RowNode<Types>): ReactNode {
    if (child.type === "tabset") {
        return (
            <Dockable.TabSet node={child}>
                <Dockable.TabList<Types> aria-label="Tabs">
                    {(tab) => <Dockable.Tab node={tab}>{label(tab)}</Dockable.Tab>}
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
}

const container = document.getElementById("root");
if (container) {
    createRoot(container).render(
        <Dockable.Root model={model} style={{ height: "100vh" }}>
            <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            <Dockable.Panels<Types>>
                {(tab) => <Dockable.Panel node={tab}>{tab.label}</Dockable.Panel>}
            </Dockable.Panels>
        </Dockable.Root>,
    );
}
`;

/**
 * A scratch Vite + React app in `dir` that depends on the React tarball only: the core tarball is
 * installed as its dependency, never declared by the app.
 */
function writeSmokeApp(dir: string, core: string, react: string): void {
    const manifest = {
        name: "dockable-smoke",
        private: true,
        type: "module",
        dependencies: {
            "@fragiola/dockable-react": `file:${react}`,
            react: examplesVersion("react"),
            "react-dom": examplesVersion("react-dom"),
        },
        devDependencies: {
            "@types/react": examplesVersion("@types/react"),
            "@types/react-dom": examplesVersion("@types/react-dom"),
            "@vitejs/plugin-react": examplesVersion("@vitejs/plugin-react"),
            typescript: examplesVersion("typescript"),
            vite: examplesVersion("vite"),
        },
    };
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );
    // The React tarball depends on the core at its own version, which the registry may not have:
    // the packed core stands in for it. A file of its own also keeps the app out of any workspace.
    writeFileSync(
        join(dir, "pnpm-workspace.yaml"),
        `overrides:\n  "@fragiola/dockable": "file:${core}"\n`,
    );
    writeFileSync(
        join(dir, "vite.config.js"),
        `import react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [react()] });\n`,
    );
    writeFileSync(
        join(dir, "index.html"),
        `<!doctype html>\n<html lang="en">\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
    );
    // strict, with the published declarations checked too (no skipLibCheck)
    const tsconfig = {
        compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            noUncheckedIndexedAccess: true,
            verbatimModuleSyntax: true,
            noEmit: true,
            types: [],
        },
        include: ["src"],
    };
    writeFileSync(
        join(dir, "tsconfig.json"),
        `${JSON.stringify(tsconfig, null, 4)}\n`,
    );
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/main.tsx"), SMOKE_MAIN);
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port =
                typeof address === "object" && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

async function fetchOk(url: string): Promise<string> {
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
        throw new Error(`${url}: ${response.status}\n${body.slice(0, 2000)}`);
    }
    return body;
}

/** The absolute imports of a module served by Vite (`/node_modules/.vite/deps/…`, `/@id/…`). */
export function servedImports(code: string): string[] {
    return [...code.matchAll(/(?:from|import)\s*["'](\/[^"']+)["']/g)].flatMap(
        ([, path]) => (path === undefined ? [] : [path]),
    );
}

/** Starts the app's dev server, loads the entry and every module it imports, then stops it. */
async function loadThroughDevServer(dir: string): Promise<void> {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const server = spawn(
        process.execPath,
        [
            join(dir, "node_modules/vite/bin/vite.js"),
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--strictPort",
        ],
        { cwd: dir, stdio: "inherit" },
    );
    const exited = new Promise<void>((resolve) => {
        server.once("exit", () => resolve());
    });
    try {
        const deadline = Date.now() + 30_000;
        for (;;) {
            try {
                await fetchOk(`${base}/`);
                break;
            } catch (error) {
                if (Date.now() > deadline) throw error;
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }
        const entry = await fetchOk(`${base}/src/main.tsx`);
        const imports = servedImports(entry);
        if (!imports.some((path) => path.includes("@fragiola"))) {
            throw new Error(
                `the dev server's entry imports no package:\n${entry}`,
            );
        }
        for (const path of imports) {
            await fetchOk(`${base}${path}`);
        }
        console.log(
            `check-package: the dev server loads the entry (${imports.length} imports)`,
        );
    } finally {
        // the app's directory is removed next: the server must be gone first
        server.kill();
        await exited;
    }
}

async function main() {
    const packs = mkdtempSync(join(tmpdir(), "dockable-pack-"));
    const app = mkdtempSync(join(tmpdir(), "dockable-smoke-"));
    try {
        const names = readdirSync(join(root, "packages"));
        const tarballs = new Map(
            names.map((name) => [name, pack(name, packs)]),
        );
        const problems = [...tarballs].flatMap(([name, tarball]) =>
            lint(name, tarball),
        );
        if (problems.length > 0) {
            throw new Error(
                `The packed exports are wrong:\n${problems.join("\n")}`,
            );
        }
        const core = tarballs.get("core");
        const react = tarballs.get("react");
        if (core === undefined || react === undefined) {
            throw new Error("packages/core and packages/react are expected");
        }
        // one core per page (the drag state is page-wide): the React package pins its exact version
        const coreVersion = packedManifest(core).version;
        const pinned =
            packedManifest(react).dependencies?.["@fragiola/dockable"];
        if (pinned !== coreVersion) {
            throw new Error(
                `@fragiola/dockable-react depends on the core at "${pinned}", not at ${coreVersion}`,
            );
        }
        writeSmokeApp(app, core, react);
        run("pnpm", ["install", "--no-frozen-lockfile"], app);
        run("pnpm", ["exec", "tsc", "--noEmit"], app);
        run("pnpm", ["exec", "vite", "build"], app);
        await loadThroughDevServer(app);
        console.log("check-package: both packages can be published");
    } finally {
        rmSync(packs, { recursive: true, force: true, maxRetries: 5 });
        rmSync(app, { recursive: true, force: true, maxRetries: 5 });
    }
}

// only when run, not when a test imports it (`import.meta.main` holds through a symlinked path)
if (import.meta.main) {
    await main();
}
