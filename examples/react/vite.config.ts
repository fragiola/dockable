import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { buildManifest } from "./scripts/manifest.ts";
import { THEMES } from "./src/examples/_themes/themes.ts";

// The embed app of the site export (contract v1, §5): `index.html?id=<id>&theme=<name>` renders
// one example on the whole viewport, with no chrome. It is built for `<base>/embed/react/`
// (`EMBED_BASE`, set by site/export.ts); everything it opens (popout.html) lives under that base.

const base = process.env.EMBED_BASE ?? "/";

/**
 * Applies `?theme=` before the first paint (§5.1): the scheme on `<html>` (`data-theme`, `.dark`)
 * for the Fragiola palettes, and the example theme on the stage, which is in index.html so the
 * script can reach it. Missing or unknown → the first light theme. The theme list comes from
 * src/examples/_themes/themes.ts, so the two cannot drift.
 */
function prePaintTheme(): Plugin {
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
    document.getElementById("root").dataset.exampleTheme = theme;
})();`;
    return {
        name: "pre-paint-theme",
        transformIndexHtml: () => [
            { tag: "script", children: script, injectTo: "body" },
        ],
    };
}

/**
 * In dev, `<base>manifest.json` is served too, built per request (the site in dev reads it through
 * its proxy); the files are read fresh, a meta.ts change needs a restart. The build's manifest is
 * written by site/export.ts.
 */
function devManifest(): Plugin {
    return {
        name: "dev-manifest",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.split("?")[0] !== `${base}manifest.json`) {
                    return next();
                }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(await buildManifest()));
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    base,
    plugins: [react(), tailwindcss(), prePaintTheme(), devManifest()],
    resolve: {
        // `#/` is src/: the examples and the Fragiola UI files vendored next to them (§6)
        alias: [
            {
                find: /^#\//,
                replacement: `${resolve(import.meta.dirname, "src")}/`,
            },
        ],
        // dev resolves the workspace packages to their sources; the build uses `dist`
        ...(command === "serve" ? { conditions: ["development"] } : {}),
    },
    // echarts (~1.1 MB) is its own chunk, loaded only by the examples that draw a chart
    build: { chunkSizeWarningLimit: 1200 },
    server: { port: Number(process.env.PORT ?? 5180), strictPort: true },
}));
