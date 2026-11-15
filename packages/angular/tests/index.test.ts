import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as angular from "../src/public-api";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** React's primitives (`Dockable.X`), from its namespace module. */
const reactParts = exportedNames(read("../react/src/parts.ts"));
/** React's hooks (`useX`). */
const reactHooks = exportedNames(read("../react/src/index.ts")).filter((name) =>
    /^use[A-Z]/.test(name),
);

/** What only the Angular package exports, and why (documented on the Angular API page). */
const ANGULAR_ONLY = [
    // every directive, for a standalone component's `imports` (React's `Dockable` namespace)
    "DOCKABLE",
    // the recursion as template directives (React's children functions and `renderSplitter`)
    "DockableRowChild",
    "DockableRowSplitter",
    "DockableTabListItem",
    "DockableBordersBar",
    "DockableBordersContent",
    "DockableBorderSplitter",
    // the root element of a window layout (React's Popout renders it)
    "DockablePopoutLayout",
    // a drag handle for a tab or a tabset (React spreads `useDragNode`'s props)
    "DockableDragNode",
];

/** `useTabSet` → `injectTabSet`. */
const injectionOf = (hook: string) => `inject${hook.slice("use".length)}`;

/** the files the package sources import */
const sources = () => {
    const dir = join(import.meta.dirname, "..", "src");
    const files: string[] = [];
    const walk = (folder: string) => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            const full = join(folder, entry.name);
            if (entry.isDirectory()) walk(full);
            else files.push(full);
        }
    };
    walk(dir);
    return files;
};

describe("@fragiola/dockable-angular", () => {
    it("re-exports the whole core", () => {
        expect(read("src/public-api.ts")).toMatch(
            /^export \* from "@fragiola\/dockable";$/m,
        );
    });

    it("exports every runtime export of the core, identical", () => {
        const exported = new Map(Object.entries(angular));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("declares no name of its own that the core exports", () => {
        // a local export silently wins over `export *`: it would hide the core's
        const coreNames = new Set([
            ...exportedNames(read("../core/src/index.ts")),
            ...Object.keys(core),
        ]);
        const own = exportedNames(read("src/public-api.ts"));
        expect(own).toContain("DockableRoot");
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });

    it("has a directive for every React primitive (Dockable.X → DockableX)", () => {
        expect(reactParts.length).toBeGreaterThan(15);
        for (const part of reactParts) {
            expect(Object.keys(angular), `Dockable.${part}`).toContain(
                `Dockable${part}`,
            );
            expect(angular.DOCKABLE, `Dockable${part}`).toContain(
                (angular as Record<string, unknown>)[`Dockable${part}`],
            );
        }
    });

    it("has an injection function for every React hook (useX → injectX)", () => {
        expect(reactHooks.length).toBeGreaterThan(8);
        for (const hook of reactHooks) {
            expect(
                typeof (angular as Record<string, unknown>)[injectionOf(hook)],
                hook,
            ).toBe("function");
        }
    });

    it("exports nothing at runtime but the core, the counterparts and the Angular-only names", () => {
        const expected = new Set([
            ...Object.keys(core),
            ...reactParts.map((part) => `Dockable${part}`),
            ...reactHooks.map(injectionOf),
            ...ANGULAR_ONLY,
        ]);
        expect(
            Object.keys(angular).filter((name) => !expected.has(name)),
        ).toEqual([]);
        for (const name of ANGULAR_ONLY) {
            expect(Object.keys(angular)).toContain(name);
        }
        // every directive is in DOCKABLE
        const directives = Object.keys(angular).filter(
            (name) => name.startsWith("Dockable") && !(name in core),
        );
        expect(angular.DOCKABLE).toHaveLength(directives.length);
    });

    it("exports the React package's state type names", () => {
        const reactStates = exportedNames(read("../react/src/index.ts")).filter(
            (name) => /^[A-Z]\w*State$/.test(name),
        );
        expect(reactStates.length).toBeGreaterThan(15);
        const own = new Set(exportedNames(read("src/public-api.ts")));
        expect(reactStates.filter((name) => !own.has(name))).toEqual([]);
    });

    it("imports nothing at runtime but @angular/core and the core, and depends on the core only", () => {
        const pkg = JSON.parse(read("package.json")) as {
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {})).toEqual([
            "@fragiola/dockable",
        ]);
        expect(Object.keys(pkg.peerDependencies ?? {})).toEqual([
            "@angular/core",
        ]);
        const IMPORT = /(?:from\s+|import\s*\(\s*)["']([^"'.][^"']*)["']/g;
        for (const file of sources()) {
            for (const [, specifier] of readFileSync(file, "utf8").matchAll(
                IMPORT,
            )) {
                expect(["@angular/core", "@fragiola/dockable"], file).toContain(
                    specifier,
                );
            }
        }
    });
});
