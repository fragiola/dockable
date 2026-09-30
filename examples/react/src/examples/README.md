# Examples

Each folder is one example of the site's gallery (`fragiola.com/dockable/examples/<folder>`),
rendered alone by this app at `index.html?id=<folder>`.

```
src/examples/
  <slug>/index.tsx     the example (default export, "use client")
  <slug>/meta.ts       title, description, level, order, features, docs link, layout, height
  <slug>/*.ts(x)       optional sibling files, shown in the code panel
  _kit/                the shared layout recursion, class names, labels and demo content
  _themes/             the five themes (one CSS file each) and their list (themes.ts)
```

## Adding an example

1. Create `src/examples/<slug>/index.tsx` and `src/examples/<slug>/meta.ts` (see
   `meta-types.ts`).
2. `pnpm dev` at the root lists it in the playground (`apps/playground`), with hot reload, the five
   themes and its source: `http://localhost:5173/?example=<slug>`. The embed alone is
   `pnpm --filter examples-react dev` (`http://localhost:5180/?id=<slug>`, it regenerates the
   loaders); `pnpm site:dev --base /dockable` serves it the way the site proxies it.
3. The smoke e2e visits it in every theme, and inside an iframe. Add a spec for its main
   behaviour in `e2e/examples/<slug>.spec.ts`.

## Rules (the docs Epic, DD6–DD12)

- **Copyable imports only**: `react`, `@fragiola/dockable`, `@fragiola/dockable-react`,
  `lucide-react`, Fragiola UI (`#/components/ui/*`, `#/components/atoms/*`, `#/lib/cn`,
  `#/hooks/*`), and relative files inside `src/examples/`. `#/` is the app's `src/`; `@name` is
  reserved for packages (site export contract, §6). `tests/examples.test.ts` enforces it.
- **Theme-agnostic**: style through palette roles (`bg-palette-base`, …) and the kit tokens
  (`--dk-*`), never fixed colours, so the example works in all five themes.
- **Through the model**: every change is `model.doAction(Actions.x)` or `engine.doAction(…)`,
  interceptable by `onAction`. Never mutate nodes.
- **State as data**: style the package's state through `data-*` and ARIA only.
- **Accessible names**: every button has `aria-label` or text; the package renders none.
- **Workarounds are commented** in the code (users copy them) and listed in
  `docs/docs-examples-gaps.md` at the repo root.
