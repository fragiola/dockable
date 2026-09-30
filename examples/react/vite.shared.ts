import { resolve } from "node:path";
import type { Plugin, UserConfig } from "vite";
import { THEMES } from "./src/examples/_themes/themes.ts";

// How an app renders the examples in place: shared by this app's Vite config and
// apps/playground's, so the two cannot drift.

/** What `#/` points at: the examples, and the Fragiola UI files vendored next to them (§6). */
export const EXAMPLES_SRC = resolve(import.meta.dirname, "src");

/**
 * `#/` is src/. Dev resolves the workspace packages to their sources (the `development` export
 * condition) so the core and React sources hot-reload; the build uses `dist`. One React: the
 * playground imports these files from outside this app.
 */
export function examplesResolve(
    command: "serve" | "build",
): UserConfig["resolve"] {
    return {
        alias: [{ find: /^#\//, replacement: `${EXAMPLES_SRC}/` }],
        dedupe: ["react", "react-dom"],
        ...(command === "serve" ? { conditions: ["development"] } : {}),
    };
}

/**
 * Applies `?theme=` before the first paint (§5.1): the scheme on `<html>` (`data-theme`, `.dark`)
 * for the Fragiola palettes and, with `stage`, the example theme on the element of that id (it
 * must be in index.html so the script can reach it). Missing or unknown → the first light theme.
 * The theme list comes from src/examples/_themes/themes.ts, so the two cannot drift.
 */
export function prePaintTheme({ stage }: { stage?: string } = {}): Plugin {
    const schemes = Object.fromEntries(
        THEMES.map((theme) => [theme.name, theme.scheme]),
    );
    const fallback = THEMES.find((theme) => theme.scheme === "light")?.name;
    const onStage =
        stage === undefined
            ? ""
            : `\n    document.getElementById(${JSON.stringify(stage)}).dataset.exampleTheme = theme;`;
    const script = `(() => {
    const schemes = ${JSON.stringify(schemes)};
    const asked = new URLSearchParams(location.search).get("theme");
    const theme = asked && Object.hasOwn(schemes, asked) ? asked : ${JSON.stringify(fallback)};
    const html = document.documentElement;
    html.dataset.theme = schemes[theme];
    html.classList.toggle("dark", schemes[theme] === "dark");${onStage}
})();`;
    return {
        name: "pre-paint-theme",
        transformIndexHtml: () => [
            { tag: "script", children: script, injectTo: "body" },
        ],
    };
}
