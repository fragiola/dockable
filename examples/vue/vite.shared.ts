import { resolve } from "node:path";
import { THEMES } from "examples-shared/themes";
import {
    defaultClientConditions,
    defaultServerConditions,
    type Plugin,
    type UserConfig,
} from "vite";
import { withSourceCondition } from "../../scripts/source-condition.ts";

// How this app renders the examples: shared by its Vite config and its Vitest config.

/** What `#/` points at: the examples, and the styles and helpers next to them (§6). */
export const EXAMPLES_SRC = resolve(import.meta.dirname, "src");

/** For a Vitest project: the workspace packages from their sources in both environments. */
export function examplesTestResolve(): Pick<UserConfig, "resolve" | "ssr"> {
    return {
        resolve: examplesResolve("serve"),
        ssr: {
            resolve: {
                conditions: withSourceCondition(defaultServerConditions),
            },
        },
    };
}

/**
 * `#/` is src/. Dev resolves the workspace packages to their sources (the source condition) so the
 * core and Vue sources hot-reload; the build uses `dist`.
 */
export function examplesResolve(
    command: "serve" | "build",
): UserConfig["resolve"] {
    return {
        alias: [{ find: /^#\//, replacement: `${EXAMPLES_SRC}/` }],
        dedupe: ["vue"],
        ...(command === "serve"
            ? { conditions: withSourceCondition(defaultClientConditions) }
            : {}),
    };
}

/**
 * Applies `?theme=` before the first paint (§5.1): the scheme on `<html>` (`data-theme`, `.dark`)
 * for the Fragiola palettes, and the example theme on `<body>` (`data-example-theme`). Missing or
 * unknown → the first light theme. The same script as examples/react's (the list comes from
 * examples/shared/src/themes/themes.ts).
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
