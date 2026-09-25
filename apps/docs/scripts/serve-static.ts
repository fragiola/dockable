// Serves the static export (out/) under the base path, the way GitHub Pages
// does: /dockable/examples/x/ → out/examples/x/index.html.
//
//   NEXT_PUBLIC_BASE_PATH=/dockable node scripts/serve-static.ts [port]
//
// Used by the e2e suite, so the tests run against what gets deployed rather
// than `next dev`. No dependency: node:http is enough for a static folder.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../out");
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4310);

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
};

async function resolveFile(pathname: string): Promise<string | undefined> {
    const safe = normalize(decodeURIComponent(pathname)).replace(
        /^(\.\.[/\\])+/,
        "",
    );
    const candidates = [
        join(OUT, safe),
        join(OUT, safe, "index.html"),
        join(OUT, `${safe}.html`),
    ];
    for (const candidate of candidates) {
        if (!candidate.startsWith(OUT)) continue;
        const info = await stat(candidate).catch(() => undefined);
        if (info?.isFile()) return candidate;
    }
    return undefined;
}

createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (BASE && !url.pathname.startsWith(BASE)) {
        response.writeHead(302, { location: `${BASE}/` });
        response.end();
        return;
    }
    const pathname = url.pathname.slice(BASE.length) || "/";
    const file = await resolveFile(pathname);
    const status = file ? 200 : 404;
    const served = file ?? join(OUT, "404.html");
    response.writeHead(status, {
        "content-type": TYPES[extname(served)] ?? "application/octet-stream",
    });
    createReadStream(served).pipe(response);
}).listen(PORT, () => {
    console.log(`serving ${OUT} at http://localhost:${PORT}${BASE}/`);
});
