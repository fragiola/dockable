import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
    collectFiles,
    EXAMPLES_DIR,
    type ExampleEntry,
    importsOf,
    listExampleSlugs,
    loadExamples,
} from "../scripts/examples-lib.ts";

// The example contract (DD6–DD8): every example has a valid meta.ts, is in the
// manifest, imports only what a consumer can copy, and the code panel lists
// exactly the files it is compiled from.

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^react$/,
    /^react-dom$/,
    /^@fragiola\/dockable$/,
    /^@fragiola\/dockable-react$/,
    /^lucide-react$/,
    /^echarts$/,
    /^@\/components\/(ui|atoms)\/[a-z-]+$/,
    /^@\/lib\/cn$/,
    /^@\/hooks\/[a-z-]+$/,
];

/** Site files under examples/ that are not example code. */
const SITE_FILES = [
    /^[a-z-]+\/meta\.ts$/,
    /^meta-types\.ts$/,
    /^entry-types\.ts$/,
    /\.generated\.ts$/,
    /^_themes\/themes\.ts$/,
    /\.md$/,
    /\.css$/,
];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

let examples: ExampleEntry[] = [];

beforeAll(async () => {
    examples = await loadExamples();
});

describe("the examples", () => {
    it("are all in the manifest, each with a valid meta", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(listExampleSlugs());
    });

    it("have unique titles and orders within a level", () => {
        const titles = examples.map((e) => e.meta.title);
        expect(new Set(titles).size).toBe(titles.length);
        const orders = examples.map((e) => `${e.meta.level}:${e.meta.order}`);
        expect(new Set(orders).size).toBe(orders.length);
    });

    it("link their guide under /docs/ when they name one", () => {
        for (const example of examples) {
            if (example.meta.docs) {
                expect(example.meta.docs, example.slug).toMatch(/^\/docs\//);
            }
        }
    });

    it("import only what a consumer can copy (DD8)", () => {
        const files = walk(EXAMPLES_DIR)
            .map((file) => relative(EXAMPLES_DIR, file))
            .filter(
                (file) => !SITE_FILES.some((pattern) => pattern.test(file)),
            );
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
            for (const specifier of importsOf(source)) {
                if (specifier.startsWith(".")) continue;
                expect(
                    ALLOWED.some((pattern) => pattern.test(specifier)),
                    `${file} imports "${specifier}"`,
                ).toBe(true);
            }
        }
    });

    it("show in the code panel exactly the files they are compiled from (DD7)", () => {
        for (const example of examples) {
            const { files } = collectFiles(example.slug);
            expect(example.files).toEqual(files);
            expect(files[0]).toBe(`${example.slug}/index.tsx`);
            // closure: every relative import of a listed file is listed too
            for (const file of files) {
                const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
                const relativeImports = importsOf(source).filter((s) =>
                    s.startsWith("."),
                );
                for (const specifier of relativeImports) {
                    const resolved = files.some((listed) => {
                        const base = join(file, "..", specifier);
                        return [base, `${base}.ts`, `${base}.tsx`].some(
                            (candidate) =>
                                relative(
                                    EXAMPLES_DIR,
                                    join(EXAMPLES_DIR, candidate),
                                ) === listed,
                        );
                    });
                    expect(resolved, `${file} → ${specifier}`).toBe(true);
                }
            }
        }
    });
});
