import { describe, expect, it } from "vitest";
import {
    exportProblems,
    publishedExportsProblems,
    servedImports,
    withoutSource,
} from "../../scripts/check-package.ts";
import { SOURCE_CONDITION } from "../../scripts/source-condition.ts";

// `pnpm check:package` runs scripts/check-package.ts over the packed packages.
describe("the packed package check", () => {
    const published = {
        ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            default: "./dist/index.js",
        },
        "./package.json": "./package.json",
    };
    const repo = {
        ".": { [SOURCE_CONDITION]: "./src/index.ts", ...published["."] },
        "./package.json": "./package.json",
    };

    it("accepts dist-only exports with the types, import and default conditions", () => {
        expect(exportProblems(published)).toEqual([]);
    });

    it("rejects any other condition, and a target outside dist", () => {
        expect(
            exportProblems({
                ".": {
                    "@fragiola/source": "./src/index.ts",
                    development: "./dist/index.js",
                    "@acme/anything": "./dist/index.js",
                    import: "./dist/index.js",
                },
            }),
        ).toEqual([
            'exports["."]: the "@fragiola/source" condition is published',
            'exports["."]["@fragiola/source"]: "./src/index.ts" is not in dist',
            'exports["."]: the "development" condition is published',
            'exports["."]: the "@acme/anything" condition is published',
        ]);
        expect(exportProblems(undefined)).toHaveLength(1);
    });

    it("takes the published exports for the repo's, without the source condition", () => {
        expect(withoutSource(repo)).toEqual(published);
        expect(publishedExportsProblems(repo, published)).toEqual([]);
    });

    it("finds published exports that drifted from the repo's", () => {
        const { default: _, ...noDefault } = published["."];
        expect(
            publishedExportsProblems(repo, { ...published, ".": noDefault }),
        ).toHaveLength(1);
        expect(
            publishedExportsProblems(repo, {
                ...published,
                "./extra": "./dist/extra.js",
            }),
        ).toHaveLength(1);
        expect(
            publishedExportsProblems(repo, {
                ".": { ...published["."], import: "./dist/other.js" },
                "./package.json": "./package.json",
            }),
        ).toHaveLength(1);
    });

    it("lists the absolute imports of a module the dev server served", () => {
        expect(
            servedImports(
                'import "/@vite/client";\nimport { Dockable } from "/node_modules/.vite/deps/x.js?v=1";\nimport React from "react";',
            ),
        ).toEqual(["/@vite/client", "/node_modules/.vite/deps/x.js?v=1"]);
    });
});
