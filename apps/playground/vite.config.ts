import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = import.meta.dirname;

// Every fixture and example is its own page: `fixtures/<name>/index.html`, `examples/<name>/index.html`.
function pages(dir: string): Record<string, string> {
    const base = resolve(root, dir);
    if (!existsSync(base)) return {};
    return Object.fromEntries(
        readdirSync(base)
            .filter((name) => existsSync(resolve(base, name, "index.html")))
            .map((name) => [
                `${dir}/${name}`,
                resolve(base, name, "index.html"),
            ]),
    );
}

export default defineConfig(({ command }) => ({
    // Tailwind is a playground concern only (the styled example); no package depends on it
    plugins: [react(), tailwindcss()],
    // In dev, resolve the workspace packages to their sources (the `development` export
    // condition) so the core and React sources hot-reload. The build uses `dist`.
    resolve: command === "serve" ? { conditions: ["development"] } : {},
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    build: {
        rollupOptions: {
            input: {
                index: resolve(root, "index.html"),
                ...pages("fixtures"),
                ...pages("examples"),
            },
        },
    },
}));
