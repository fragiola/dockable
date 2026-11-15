import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { examplesApp } from "examples-shared/scripts/examples-lib";
import { buildManifest } from "examples-shared/scripts/manifest";
import { defineConfig, type Plugin } from "vite";
import { examplesResolve, prePaintTheme } from "./vite.shared.ts";

// The Vue embed app of the site export (contract v1, §5): `index.html?id=<id>&theme=<name>`
// renders one example on the whole viewport, with no chrome. It is built for `<base>/embed/vue/`
// (`EMBED_BASE`, set by site/export.ts) into `EMBED_OUT_DIR` (default `dist`); everything it opens
// (popout.html) lives under that base.

const base = process.env.EMBED_BASE ?? "/";
const outDir = process.env.EMBED_OUT_DIR;

/** In dev, `<base>manifest.json` is served too, built per request (as examples/react does). */
function devManifest(): Plugin {
    return {
        name: "dev-manifest",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.split("?")[0] !== `${base}manifest.json`) {
                    return next();
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                    JSON.stringify(await buildManifest(examplesApp("vue"))),
                );
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    base,
    plugins: [vue(), tailwindcss(), prePaintTheme(), devManifest()],
    resolve: examplesResolve(command),
    build: outDir ? { outDir, emptyOutDir: true } : {},
    server: { port: Number(process.env.PORT ?? 5181), strictPort: true },
}));
