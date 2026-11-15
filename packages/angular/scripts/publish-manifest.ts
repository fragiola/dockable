// Writes the manifest ng-packagr's output is published with (`dist/package.json`), after
// `ng-packagr` built it. pnpm packs and publishes `dist` (`publishConfig.directory`), so this
// manifest is the published one:
//
// - its `exports` are the package's own without the source condition, relative to `dist`
//   (`./dist/fesm2022/…` becomes `./fesm2022/…`): the subpaths, conditions and order
//   `check:package` compares with the repo's;
// - its dependencies are the package's (the core, `workspace:*`, which pnpm replaces with the exact
//   version when it packs): ng-packagr adds `tslib`, which the partial compilation output never
//   imports (ES2022 classes, no decorators), and which would be a runtime dependency beyond the core;
// - `scripts`, `devDependencies` and `publishConfig` are dropped; ng-packagr's `module` and
//   `typings` are kept.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const SOURCE_CONDITION = "@fragiola/source";

type Manifest = Record<string, unknown> & {
    exports?: unknown;
    dependencies?: Record<string, string>;
};

/** `exports` without the source condition, with targets relative to `dist` (key order kept). */
export function distExports(exports: unknown): unknown {
    if (typeof exports === "string") {
        return exports.startsWith("./dist/")
            ? `./${exports.slice("./dist/".length)}`
            : exports;
    }
    if (exports === null || typeof exports !== "object") {
        return exports;
    }
    return Object.fromEntries(
        Object.entries(exports)
            .filter(([key]) => key !== SOURCE_CONDITION)
            .map(([key, value]) => [key, distExports(value)]),
    );
}

function main() {
    const source = JSON.parse(
        readFileSync(join(root, "package.json"), "utf8"),
    ) as Manifest;
    const built = JSON.parse(
        readFileSync(join(root, "dist/package.json"), "utf8"),
    ) as Manifest;
    const bundle = readFileSync(
        join(root, "dist/fesm2022/fragiola-dockable-angular.mjs"),
        "utf8",
    );
    if (/from\s*["']tslib["']/.test(bundle)) {
        throw new Error(
            "dist/fesm2022 imports tslib: it would be a runtime dependency beyond the core",
        );
    }
    const {
        scripts: _scripts,
        devDependencies: _devDependencies,
        publishConfig: _publishConfig,
        ...published
    } = source;
    const manifest: Manifest = {
        ...published,
        exports: distExports(source.exports),
        module: built.module,
        typings: built.typings,
    };
    writeFileSync(
        join(root, "dist/package.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );
    console.log("publish-manifest: dist/package.json written");
}

// only when run, not when a test imports it (`import.meta.main` holds through a symlinked path)
if (import.meta.main) {
    main();
}
