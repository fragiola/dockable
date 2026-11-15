import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    collectFiles,
    examplesApp,
    importsOf,
    listExampleSlugs,
} from "examples-shared/scripts/examples-lib";
import { describe, expect, it } from "vitest";

// The Angular side of the example contract: an example is standalone components in TypeScript
// (`index.ts` its entry, default-exporting the example's component; templates inline) and
// `styles.ts`, importing only what a consumer can copy: Angular, the Angular package, the icons,
// `#/lib/cn` and relative files inside examples/. Every example assembles Dockable itself.

const APP = examplesApp("angular");

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^@angular\/(core|common)$/,
    /^@fragiola\/dockable-angular$/,
    /^@lucide\/angular$/,
    /^#\/lib\/cn$/,
];

describe("examples-angular", () => {
    const slugs = listExampleSlugs(APP);

    it("has examples, every one of examples/react's", () => {
        expect(slugs.length).toBeGreaterThan(0);
        const react = listExampleSlugs(examplesApp("react"));
        expect(slugs.filter((slug) => !react.includes(slug))).toEqual([]);
    });

    it.each(slugs)("%s imports only what a consumer copies", (slug) => {
        const { files } = collectFiles(APP, slug);
        expect(files[0]).toBe(`${slug}/index.ts`);
        for (const file of files) {
            const source = readFileSync(join(APP.examplesDir, file), "utf8");
            for (const specifier of importsOf(source)) {
                if (specifier.startsWith(".")) continue;
                expect(
                    ALLOWED.some((pattern) => pattern.test(specifier)),
                    `${file}: ${specifier}`,
                ).toBe(true);
            }
        }
    });

    it.each(slugs)("%s assembles Dockable in its own files", (slug) => {
        const { files } = collectFiles(APP, slug);
        const sources = files
            .filter((file) => file.startsWith(`${slug}/`))
            .map((file) => readFileSync(join(APP.examplesDir, file), "utf8"));
        expect(
            sources.some((source) => source.includes("[dockableRoot]")),
        ).toBe(true);
    });

    it.each(slugs)("%s default-exports its component", (slug) => {
        const source = readFileSync(
            join(APP.examplesDir, slug, "index.ts"),
            "utf8",
        );
        expect(source).toMatch(/^export default class \w+/m);
    });

    it.each(slugs)("%s keeps class strings out of its templates", (slug) => {
        const { files } = collectFiles(APP, slug);
        for (const file of files.filter((name) =>
            name.startsWith(`${slug}/`),
        )) {
            const source = readFileSync(join(APP.examplesDir, file), "utf8");
            // looks go in styles.ts and are bound (`[class]="styles.part"`)
            expect(/\sclass="/.test(source), file).toBe(false);
        }
    });
});
