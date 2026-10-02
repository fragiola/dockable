import { resolve } from "node:path";
import {
    defaultClientConditions,
    defaultServerConditions,
    type Plugin,
    type UserConfig,
} from "vite";
import { THEMES } from "./src/examples/_themes/themes.ts";

// How an app renders the examples in place: shared by this app's Vite config and
// apps/playground's, so the two cannot drift.

/** What `#/` points at: the examples, and the Fragiola UI files vendored next to them (§6). */
export const EXAMPLES_SRC = resolve(import.meta.dirname, "src");

/**
 * The export condition that points the workspace packages at their sources (first key of their
 * `exports`). Namespaced so that no consumer's tool ever sets it; the published `exports`
 * (`publishConfig`) do not carry it.
 */
export const SOURCE_CONDITION = "@fragiola/source";

/**
 * Vite's default conditions with the source one first. Setting `conditions` replaces Vite's
 * defaults, so they are spread back: `client` for the browser (and jsdom), `server` for the
 * node environment of Vitest.
 */
export function sourceConditions(target: "client" | "server"): string[] {
    return [
        SOURCE_CONDITION,
        ...(target === "client"
            ? defaultClientConditions
            : defaultServerConditions),
    ];
}

/**
 * `#/` is src/. Dev resolves the workspace packages to their sources (`SOURCE_CONDITION`) so the
 * core and React sources hot-reload; the build uses `dist`. One React: the playground imports
 * these files from outside this app.
 */
export function examplesResolve(
    command: "serve" | "build",
): UserConfig["resolve"] {
    return {
        alias: [{ find: /^#\//, replacement: `${EXAMPLES_SRC}/` }],
        dedupe: ["react", "react-dom"],
        ...(command === "serve"
            ? { conditions: sourceConditions("client") }
            : {}),
    };
}

/**
 * Applies `?theme=` before the first paint (§5.1): the scheme on `<html>` (`data-theme`, `.dark`)
 * for the Fragiola palettes, and the example theme on `<body>` (`data-example-theme`), so
 * everything in the document takes it: the example, the menus and dialogs portalled into
 * `<body>`, and popout windows (`popoutMirrorRoot` copies `<body>`'s attributes into them).
 * Missing or unknown → the first light theme. The theme list comes from
 * src/examples/_themes/themes.ts, so the two cannot drift.
 */
export function prePaintTheme(): Plugin {
    const schemes = Object.fromEntries(
        THEMES.map((theme) => [theme.name, theme.scheme]),
    );
    const fallback = THEMES.find((theme) => theme.scheme === "light")?.name;
    const script = `(() => {
    const schemes = ${JSON.stringify(schemes)};
    const asked = new URLSearchParams(location.search).get("theme");
    const theme = asked && Object.hasOwn(schemes, asked) ? asked : ${JSON.stringify(fallback)};
    const html = document.documentElement;
    html.dataset.theme = schemes[theme];
    html.classList.toggle("dark", schemes[theme] === "dark");
    document.body.dataset.exampleTheme = theme;
})();`;
    return {
        name: "pre-paint-theme",
        transformIndexHtml: () => [
            { tag: "script", children: script, injectTo: "body-prepend" },
        ],
    };
}
