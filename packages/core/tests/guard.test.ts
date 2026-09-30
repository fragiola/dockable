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

/** Source text with comments and string literals blanked out, so only code is scanned. */
function codeOnly(source: string): string {
    return source.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g,
        (match) => (match.startsWith("/") ? "" : '""'),
    );
}

// the core never reaches for the browser globals: DOM access goes through an element's
// ownerDocument/defaultView (or an injected host), so it also runs in a popout and in Node
const GLOBAL_DOM =
    /(?<![.\w$])(document|window|requestAnimationFrame|cancelAnimationFrame|getComputedStyle|navigator|localStorage|sessionStorage)\b(?!\s*:)/;
const GLOBAL_CRYPTO = /(?<![.\w$])crypto\b(?!\s*:)/;

/** The folders of the new model (Engine v2). */
const ENGINE_V2 = ["state", "commands", "schema", "geometry", "split", "drop"];

/**
 * The exported declarations of a source (comments and strings already blanked): each `export`
 * statement up to its end (the first `;` or blank-line-terminated block at column 0).
 */
function exportedDeclarations(source: string): string[] {
    const declarations: string[] = [];
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!line.startsWith("export ")) {
            continue;
        }
        const block = [line];
        // a multi-line declaration runs until a line closing it at column 0
        if (!/;\s*$/.test(line) && !/^export \{.*\}.*;?$/.test(line)) {
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j] ?? "";
                block.push(next);
                if (/^[}\]);]/.test(next)) {
                    break;
                }
            }
        }
        declarations.push(block.join("\n"));
    }
    return declarations;
}

const FORBIDDEN =
    /\b(CLASSES|CSSClassNames|I18nLabelDefaults|I18nLabel|translate|setI18nDefaults|i18nTranslator)\b/;

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

    it("has no CSS class names, i18n defaults or translation", () => {
        const offenders = listFiles(src).filter((file) =>
            FORBIDDEN.test(codeOnly(readFileSync(file, "utf8"))),
        );
        expect(offenders).toEqual([]);
    });

    it("never touches global document, window or frame scheduling", () => {
        const offenders = listFiles(src).flatMap((file) => {
            const match = GLOBAL_DOM.exec(codeOnly(readFileSync(file, "utf8")));
            return match ? [`${file}: ${match[0]}`] : [];
        });
        expect(offenders).toEqual([]);
    });

    it("never reaches for the global crypto (ids come from an injectable generator)", () => {
        // the FlexLayout port (src/model) is exempt until it is removed
        const offenders = listFiles(src)
            .filter((file) => !file.startsWith(join(src, "model")))
            .flatMap((file) => {
                const match = GLOBAL_CRYPTO.exec(
                    codeOnly(readFileSync(file, "utf8")),
                );
                return match ? [`${file}: ${match[0]}`] : [];
            });
        expect(offenders).toEqual([]);
        expect(GLOBAL_CRYPTO.test(codeOnly("crypto.randomUUID()"))).toBe(true);
        expect(GLOBAL_CRYPTO.test(codeOnly("const crypto: X = y;"))).toBe(
            false,
        );
    });

    it("keeps the new model independent of the FlexLayout port", () => {
        const offenders = ENGINE_V2.flatMap((dir) =>
            listFiles(join(src, dir)),
        ).filter((file) =>
            /from\s+["'](?:\.\.?\/)+model\//.test(readFileSync(file, "utf8")),
        );
        expect(offenders).toEqual([]);
    });

    it("has no `any` in the new model's exported declarations", () => {
        const offenders = ENGINE_V2.flatMap((dir) =>
            listFiles(join(src, dir)),
        ).flatMap((file) =>
            exportedDeclarations(codeOnly(readFileSync(file, "utf8")))
                .filter((declaration) => /\bany\b/.test(declaration))
                .map((declaration) => `${file}: ${declaration.slice(0, 80)}`),
        );
        expect(offenders).toEqual([]);
        expect(
            exportedDeclarations("export type X = any;\nconst y: any = 1;"),
        ).toEqual(["export type X = any;"]);
    });

    it("detects global DOM access in code but not in comments or strings", () => {
        expect(
            GLOBAL_DOM.test(
                codeOnly("const el = document.createElement('div');"),
            ),
        ).toBe(true);
        expect(
            GLOBAL_DOM.test(codeOnly("requestAnimationFrame(() => {});")),
        ).toBe(true);
        expect(
            GLOBAL_DOM.test(
                codeOnly(
                    "el.ownerDocument.defaultView.requestAnimationFrame(cb);",
                ),
            ),
        ).toBe(false);
        expect(
            GLOBAL_DOM.test(
                codeOnly('// the popout window\nif (type === "window") {}'),
            ),
        ).toBe(false);
        expect(GLOBAL_DOM.test(codeOnly("function f(window: Window) {}"))).toBe(
            false,
        );
    });

    it("every file ported from FlexLayout carries the Caplin MIT header", () => {
        const ported = [
            ...listFiles(join(src, "model")),
            ...listFiles(join(root, "tests", "model")),
        ];
        const missing = ported.filter((file) => {
            const head = readFileSync(file, "utf8")
                .split("\n")
                .slice(0, 5)
                .join("\n");
            return !(
                head.includes("FlexLayout") &&
                head.includes("Caplin Systems Ltd") &&
                head.includes("MIT")
            );
        });
        expect(missing).toEqual([]);
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
