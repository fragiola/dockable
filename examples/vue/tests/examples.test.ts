import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    collectFiles,
    examplesApp,
    importsOf,
    listExampleSlugs,
} from "examples-shared/scripts/examples-lib";
import { describe, expect, it } from "vitest";

// The Vue side of the example contract: an example is single-file components (`index.vue` its
// entry) and `styles.ts`, importing only what a consumer can copy: `vue`, the Vue package, the
// icons, ECharts' types, the kit (`#/components/…`, `#/hooks/…`, `#/lib/cn`) and relative files
// inside examples/. Every example assembles Dockable itself.

const APP = examplesApp("vue");

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^vue$/,
    /^@fragiola\/dockable-vue$/,
    /^@lucide\/vue$/,
    /^echarts$/,
    /^#\/components\/(ui|atoms)\/[a-z-]+$/,
    /^#\/lib\/cn$/,
    /^#\/hooks\/[a-z-]+$/,
];

describe("examples-vue", () => {
    const slugs = listExampleSlugs(APP);

    it("has every example of examples/react, and no other", () => {
        expect(slugs).toEqual(listExampleSlugs(examplesApp("react")));
    });

    it.each(slugs)("%s imports only what a consumer copies", (slug) => {
        const { files } = collectFiles(APP, slug);
        expect(files[0]).toBe(`${slug}/index.vue`);
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
        const own = files.filter((file) => file.startsWith(`${slug}/`));
        const sources = own.map((file) =>
            readFileSync(join(APP.examplesDir, file), "utf8"),
        );
        expect(
            sources.some((source) => source.includes("<Dockable.Root")),
        ).toBe(true);
    });

    it.each(slugs)("%s keeps class strings out of its templates", (slug) => {
        const { files } = collectFiles(APP, slug);
        for (const file of files.filter(
            (name) => name.startsWith(`${slug}/`) && name.endsWith(".vue"),
        )) {
            const source = readFileSync(join(APP.examplesDir, file), "utf8");
            const template = source.slice(source.indexOf("<template>"));
            // looks go in styles.ts and are bound (`:class="styles.part"`)
            expect(/\sclass="/.test(template), file).toBe(false);
        }
    });
});
