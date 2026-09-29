import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { buildManifest } from "./scripts/manifest.ts";
import { examplesResolve, prePaintTheme } from "./vite.shared.ts";

// The embed app of the site export (contract v1, §5): `index.html?id=<id>&theme=<name>` renders
// one example on the whole viewport, with no chrome. It is built for `<base>/embed/react/`
// (`EMBED_BASE`, set by site/export.ts); everything it opens (popout.html) lives under that base.

const base = process.env.EMBED_BASE ?? "/";

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
    // the stage is `#root` in index.html
    plugins: [
        react(),
        tailwindcss(),
        prePaintTheme({ stage: "root" }),
        devManifest(),
    ],
    resolve: examplesResolve(command),
    // echarts (~1.1 MB) is its own chunk, loaded only by the examples that draw a chart
    build: { chunkSizeWarningLimit: 1200 },
    server: { port: Number(process.env.PORT ?? 5180), strictPort: true },
}));
