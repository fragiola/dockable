import { describe, expect, it } from "vitest";
import { exportProblems, servedImports } from "../../scripts/check-package.ts";

// `pnpm check:package` runs scripts/check-package.ts over the packed packages.
describe("the packed package check", () => {
    it("accepts dist-only exports", () => {
        expect(
            exportProblems({
                ".": {
                    types: "./dist/index.d.ts",
                    import: "./dist/index.js",
                },
                "./package.json": "./package.json",
            }),
        ).toEqual([]);
    });

    it("finds a published source condition or a target outside dist", () => {
        expect(
            exportProblems({
                ".": {
                    "@fragiola/source": "./src/index.ts",
                    development: "./dist/index.js",
                    import: "./dist/index.js",
                },
            }),
        ).toEqual([
            'exports["."]: the "@fragiola/source" condition is published',
            'exports["."]["@fragiola/source"]: "./src/index.ts" is not in dist',
            'exports["."]: the "development" condition is published',
        ]);
        expect(exportProblems(undefined)).toHaveLength(1);
    });

    it("lists the absolute imports of a module the dev server served", () => {
        expect(
            servedImports(
                'import "/@vite/client";\nimport { Dockable } from "/node_modules/.vite/deps/x.js?v=1";\nimport React from "react";',
            ),
        ).toEqual(["/@vite/client", "/node_modules/.vite/deps/x.js?v=1"]);
    });
});
