import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// The workspace root, two levels up from apps/docs.
const workspaceRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

// ─── Deploy target ───────────────────────────────────────────────────────────
// Same shape as fragiola/ui apps/www: the site is fully pre-renderable, so the
// build is a STATIC EXPORT (`out/`), which is what GitHub Pages serves.
//
//   NEXT_PUBLIC_BASE_PATH   "/dockable" on the project page
//                           (fragiola.github.io/dockable), "" on a custom
//                           domain. The Pages workflow reads it from
//                           actions/configure-pages. NEXT_PUBLIC_ because the
//                           client needs it too: the search index URL and the
//                           popout host page (popout.html) are fetched by
//                           hand, not through a Next <Link>.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ─── Workspace packages ──────────────────────────────────────────────────────
// The production build uses the packages' `dist` (so `pnpm -r build` builds
// them first). In dev, the packages resolve to their sources — the same
// intent as the playground's `development` export condition, which Turbopack
// does not let us select, so it is spelled as aliases.
const devAliases = {
    "@fragiola/dockable": path.join(workspaceRoot, "packages/core/src/index.ts"),
    "@fragiola/dockable-react": path.join(
        workspaceRoot,
        "packages/react/src/index.ts",
    ),
};

const withMDX = createMDX();

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
    const dev = phase === PHASE_DEVELOPMENT_SERVER;
    return withMDX({
        pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
        output: "export",
        outputFileTracingRoot: workspaceRoot,
        basePath,
        // Every page is a directory with an index.html, so a static host
        // resolves /examples/hello-layout/ without any rewrite rule.
        trailingSlash: true,
        images: { unoptimized: true },
        turbopack: {
            root: workspaceRoot,
            ...(dev ? { resolveAlias: devAliases } : {}),
        },
    });
}
