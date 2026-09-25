import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = import.meta.dirname;

// Every fixture and example is its own page: `fixtures/<name>/index.html`, `examples/<name>/index.html`.
function pages(dir: string): Record<string, string> {
    try {
        return Object.fromEntries(
            readdirSync(resolve(root, dir)).map((name) => [
                `${dir}/${name}`,
                resolve(root, dir, name, "index.html"),
            ]),
        );
    } catch {
        return {};
    }
}

export default defineConfig(({ command }) => ({
    plugins: [react()],
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
