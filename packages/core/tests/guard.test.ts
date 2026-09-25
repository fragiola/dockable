import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const src = join(root, "src");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

const IMPORT_REACT =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:react|react-dom)(?:\/[^"']*)?["']/;

describe("core package guard", () => {
    it("has no runtime or peer dependencies", () => {
        const pkg = JSON.parse(
            readFileSync(join(root, "package.json"), "utf8"),
        ) as Record<string, unknown>;
        expect(pkg.dependencies ?? {}).toEqual({});
        expect(pkg.peerDependencies ?? {}).toEqual({});
    });

    it("never imports react or react-dom", () => {
        const offenders = listFiles(src).filter((file) =>
            IMPORT_REACT.test(readFileSync(file, "utf8")),
        );
        expect(offenders).toEqual([]);
    });

    it("ships the root licence, including the FlexLayout notice", () => {
        const rootLicence = readFileSync(
            join(root, "..", "..", "LICENSE"),
            "utf8",
        );
        expect(rootLicence).toContain("Copyright (c) 2017 Caplin Systems Ltd");
        for (const pkg of ["core", "react"]) {
            expect(readFileSync(join(root, "..", pkg, "LICENSE"), "utf8")).toBe(
                rootLicence,
            );
        }
    });

    it("detects a react import", () => {
        expect(IMPORT_REACT.test('import type * as React from "react";')).toBe(
            true,
        );
        expect(
            IMPORT_REACT.test(
                'import { createPortal } from "react-dom/client";',
            ),
        ).toBe(true);
        expect(IMPORT_REACT.test('import { x } from "./reactive";')).toBe(
            false,
        );
    });
});
