import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    listExampleSlugs,
    loadExamples,
} from "../../../examples/react/scripts/examples-lib.ts";
import { LEVELS } from "../../../examples/react/src/examples/meta-types.ts";
import {
    entries,
    exampleSlug,
    findEntry,
    fixtures,
    repositoryPath,
    sections,
} from "../src/catalog.ts";

// The catalog reads examples/react where it lives: every example it lists is one the site shows,
// none is missing, and there is no second list to keep in step.

const examples = await loadExamples();

describe("the catalog", () => {
    it("lists every example of examples/react once, and no `_` folder", () => {
        const listed = entries
            .filter((e) => e.kind === "example")
            .map((e) => e.id)
            .sort();
        expect(listed).toEqual(listExampleSlugs());
        expect(listed.some((id) => id.startsWith("_"))).toBe(false);
    });

    it("groups the examples by level, in LEVELS order", () => {
        const section = sections.find((s) => s.kind === "example");
        const levels = section?.groups.map((g) => g.key) ?? [];
        expect(levels).toEqual(LEVELS.filter((l) => levels.includes(l)));
    });

    it("orders examples within a level by `order`", () => {
        const section = sections.find((s) => s.kind === "example");
        for (const group of section?.groups ?? []) {
            const orders = group.entries.map(
                (e) => examples.find((x) => x.slug === e.id)?.meta.order ?? 0,
            );
            expect(orders).toEqual([...orders].sort((a, b) => a - b));
        }
    });

    it("carries each example's meta: title, level, features and layout", () => {
        for (const example of examples) {
            const entry = findEntry({ kind: "example", id: example.slug });
            expect(entry?.title).toBe(example.meta.title);
            expect(entry?.group).toBe(example.meta.level);
            expect(entry?.features).toEqual(example.meta.features);
            expect(entry?.layout).toBe(example.meta.layout ?? "fill");
        }
    });

    it("shows each example's own files, entry first, without meta.ts", async () => {
        for (const entry of entries.filter((e) => e.kind === "example")) {
            const [first, ...rest] = entry.files;
            expect(first?.path, entry.id).toBe(
                `examples/react/src/examples/${entry.id}/index.tsx`,
            );
            expect(await first?.load(), entry.id).toContain("export default");
            for (const file of rest) {
                expect(file.path).toMatch(
                    new RegExp(`^examples/react/src/examples/${entry.id}/`),
                );
                expect(file.path).not.toMatch(/\/meta\.ts$/);
            }
        }
    });

    it("finds an entry by kind and id, and nothing for an unknown one", () => {
        expect(findEntry({ kind: "example", id: "hello-layout" })?.title).toBe(
            "Hello layout",
        );
        expect(findEntry({ kind: "example", id: "nope" })).toBeUndefined();
        expect(findEntry(null)).toBeUndefined();
    });
});

describe("the fixtures", () => {
    it("links every fixture page, titled by its <title>", () => {
        const dirs = readdirSync(resolve(import.meta.dirname, "../fixtures"));
        expect(fixtures.map((f) => f.name).sort()).toEqual(dirs.sort());
        expect(fixtures.find((f) => f.name === "basic")).toEqual({
            name: "basic",
            title: "Basic fixture",
            href: "/fixtures/basic/",
        });
    });
});

describe("paths", () => {
    it("reads the example of a file, skipping `_` folders and loose files", () => {
        const base = "../../../examples/react/src/examples";
        expect(exampleSlug(`${base}/hello-layout/index.tsx`)).toBe(
            "hello-layout",
        );
        expect(exampleSlug(`${base}/_kit/layout.tsx`)).toBeUndefined();
        expect(exampleSlug(`${base}/meta-types.ts`)).toBeUndefined();
    });

    it("writes glob keys from the repository root", () => {
        expect(repositoryPath("../../../examples/react/src/x.ts")).toBe(
            "examples/react/src/x.ts",
        );
        expect(repositoryPath("./scenarios/api/commands.tsx")).toBe(
            "apps/playground/src/scenarios/api/commands.tsx",
        );
    });
});
