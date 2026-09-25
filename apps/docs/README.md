# docs

The documentation site for `@fragiola/dockable`: Fumadocs docs under `/docs` and the
examples browser under `/examples`. A Next.js static export deployed to GitHub Pages
(`.github/workflows/deploy-pages.yml`), with the same config shape as `fragiola/ui` `apps/www`.

| command | does |
|---|---|
| `pnpm docs:dev` (root) | dev server on <http://localhost:3000> |
| `pnpm --filter docs... build` | builds the packages, then the static export in `out/` |
| `NEXT_PUBLIC_BASE_PATH=/dockable pnpm --filter docs serve` | serves `out/` under the base path on <http://localhost:4310/dockable/> |
| `pnpm --filter docs test` | Vitest (manifest, imports, sources, themes, docs links) |
| `pnpm --filter docs e2e` | Playwright against the static export under `/dockable` |
| `pnpm --filter docs vendor` | re-vendors the Fragiola UI registry items |

## How the workspace packages resolve

- **Build**: the packages' `dist`, so `pnpm -r build` (or `--filter docs...`) builds them first.
- **Dev**: the packages' sources. Turbopack does not let the app select the `development` export
  condition the playground uses, so `next.config.mjs` aliases both packages to their
  `src/index.ts` when the phase is the dev server. Edits in `packages/*/src` hot-reload.
- **Typecheck**: `tsconfig.json` sets `customConditions: ["development"]`, so `tsc` reads the
  sources and needs no build.

## Fragiola UI

`components/`, `lib/`, `hooks/` and `styles/` hold Fragiola UI registry items, vendored by
`scripts/vendor-fragiola.ts` from <https://ui.fragiola.com/r> (each file names its source). They
are the files a consumer gets from the registry, at the same paths, so examples that import them
copy as they are. Do not edit them: re-run the script.

## Examples

See `examples/README.md`.
