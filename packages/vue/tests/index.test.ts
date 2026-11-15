import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as vue from "../src/index";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** What only the Vue package exports, and why (documented on the Vue API page). */
const VUE_ONLY = [
    // a Vue template cannot pass a type argument (`<Dockable.Panels<Types>>` in React)
    "typedDockable",
];

/** What only the React package exports (none: every React name has a Vue counterpart). */
const REACT_ONLY: string[] = [];

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

// the React package's sources, loaded at run time (a variable path: the Vue typecheck does not
// follow it into React's TSX)
const reactEntry = join(import.meta.dirname, "../../react/src/index.ts");
const react = (await import(reactEntry)) as Record<string, unknown> & {
    Dockable: Record<string, unknown>;
};

describe("@fragiola/dockable-vue", () => {
    it("re-exports the whole core", () => {
        expect(read("src/index.ts")).toMatch(
            /^export \* from "@fragiola\/dockable";$/m,
        );
    });

    it("exports every runtime export of the core, identical", () => {
        const exported = new Map(Object.entries(vue));
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
        const own = exportedNames(read("src/index.ts"));
        expect(own).toContain("Dockable");
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });

    it("exports the React package's runtime names, but the framework-only ones", () => {
        const vueNames = Object.keys(vue)
            .filter((name) => !VUE_ONLY.includes(name))
            .sort();
        const reactNames = Object.keys(react)
            .filter((name) => !REACT_ONLY.includes(name))
            .sort();
        expect(vueNames).toEqual(reactNames);
        for (const name of VUE_ONLY) {
            expect(Object.keys(vue)).toContain(name);
        }
    });

    it("has the React package's primitives in its Dockable namespace", () => {
        expect(Object.keys(vue.Dockable).sort()).toEqual(
            Object.keys(react.Dockable).sort(),
        );
    });

    it("exports the React package's type names (State, Props, hook results)", () => {
        const reactTypes = exportedNames(read("../react/src/index.ts")).filter(
            // React's element prop helpers have no Vue counterpart: Vue binds `props` from the
            // render slot instead
            (name) =>
                ![
                    "ButtonPrimitiveProps",
                    "DivPrimitiveProps",
                    "RenderedProps",
                    "RenderProp",
                ].includes(name),
        );
        const vueTypes = new Set(exportedNames(read("src/index.ts")));
        expect(reactTypes.filter((name) => !vueTypes.has(name))).toEqual([]);
    });

    it("never imports React, and imports nothing at runtime but vue and the core", () => {
        const pkg = JSON.parse(read("package.json")) as {
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {})).toEqual([
            "@fragiola/dockable",
        ]);
        expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(["vue"]);
        const IMPORT = /(?:from\s+|import\s*\(\s*)["']([^"'.][^"']*)["']/g;
        for (const file of sources()) {
            for (const [, specifier] of readFileSync(file, "utf8").matchAll(
                IMPORT,
            )) {
                expect(["vue", "@fragiola/dockable"], file).toContain(
                    specifier,
                );
            }
        }
    });
});
