import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import * as react from "../src/index";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** The names of the `export { … } from` and `export type { … } from` statements of `source`. */
function namedExports(source: string): string[] {
    return [...source.matchAll(/export (?:type )?\{([^}]*)\} from "[^"]+"/g)]
        .flatMap(([, names = ""]) => names.split(","))
        .map((raw) =>
            raw
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)
                .pop(),
        )
        .filter((name): name is string => Boolean(name));
}

describe("@fragiola/dockable-react", () => {
    it("re-exports the whole core", () => {
        expect(read("src/index.ts")).toMatch(
            /^export \* from "@fragiola\/dockable";$/m,
        );
    });

    it("exports every runtime export of the core, identical", () => {
        const exported = new Map(Object.entries(react));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("declares no name of its own that the core exports", () => {
        // a local export silently wins over `export *`: it would hide the core's
        const coreNames = new Set(namedExports(read("../core/src/index.ts")));
        expect(coreNames.size).toBeGreaterThan(0);
        const own = [...namedExports(read("src/index.ts")), "Dockable"];
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });
});
