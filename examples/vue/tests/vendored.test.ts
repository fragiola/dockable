import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The Fragiola UI theme (the palettes, the base stylesheet), `cn`, `getToken` and the class
// families (framework-neutral `tv` strings) are vendored into examples/react by its
// scripts/vendor-fragiola.ts; this app copies them, so the Vue kit wears the React kit's classes.
// A copy is the original with its first line (the vendoring header) replaced.

const here = join(import.meta.dirname, "..");
const react = join(here, "..", "react");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

const FAMILIES = ["choice", "field", "layer", "menu", "popup", "track"];

const COPIES = [
    ...listFiles(join(here, "src/styles")),
    join(here, "src/lib/cn.ts"),
    join(here, "src/lib/get-token/index.ts"),
    ...FAMILIES.map((name) => join(here, `src/components/families/${name}.ts`)),
];

/** The original of a copy: the same path, but `field` is a `.tsx` there (no JSX, see its header). */
const originalOf = (file: string) =>
    file === "src/components/families/field.ts" ? `${file}x` : file;

const body = (source: string) => source.slice(source.indexOf("\n") + 1);

describe("the files copied from examples/react", () => {
    it.each(COPIES.map((file) => relative(here, file)))("%s", (file) => {
        const copy = readFileSync(join(here, file), "utf8");
        const original = readFileSync(join(react, originalOf(file)), "utf8");
        expect(copy.split("\n")[0]).toContain(
            `Copied from examples/react/${originalOf(file)}`,
        );
        expect(body(copy)).toBe(body(original));
    });

    it("cover every palette examples/react vendors", () => {
        const names = (dir: string) => readdirSync(dir).sort();
        expect(names(join(here, "src/styles/palettes"))).toEqual(
            names(join(react, "src/styles/palettes")),
        );
    });
});
