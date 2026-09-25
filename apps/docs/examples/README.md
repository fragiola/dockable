# Examples

Each folder is one example in the examples browser (`/examples/<folder>/`).

```
examples/
  <slug>/index.tsx     the example (default export, "use client")
  <slug>/meta.ts       title, description, level, order, features, docs link
  <slug>/*.ts(x)       optional sibling files, shown in the code panel
  _kit/                the shared layout recursion, class names, labels and demo content
  _themes/             the five themes (one CSS file each) and their list (themes.ts)
```

## Adding an example

1. Create `examples/<slug>/index.tsx` and `examples/<slug>/meta.ts` (see `meta-types.ts`).
2. `pnpm --filter docs dev` regenerates the manifest (`scripts/build-examples.ts`); the example
   appears in the sidebar under its level.
3. The smoke e2e visits it in every theme. Add a spec for its main behaviour in
   `e2e/examples/<slug>.spec.ts`.

## Rules (the docs Epic, DD6–DD12)

- **Copyable imports only**: `react`, `@fragiola/dockable`, `@fragiola/dockable-react`,
  `lucide-react`, Fragiola UI (`@/components/ui/*`, `@/components/atoms/*`, `@/lib/cn`,
  `@/hooks/*`), and relative files inside `examples/`. `tests/examples.test.ts` enforces it.
- **Theme-agnostic**: style through palette roles (`bg-palette-base`, …) and the kit tokens
  (`--dk-*`), never fixed colours, so the example works in all five themes.
- **Through the model**: every change is `model.doAction(Actions.x)` or `engine.doAction(…)`,
  interceptable by `onAction`. Never mutate nodes.
- **State as data**: style the package's state through `data-*` and ARIA only.
- **Accessible names**: every button has `aria-label` or text; the package renders none.
- **Workarounds are commented** in the code (users copy them) and listed in
  `docs/docs-examples-gaps.md` at the repo root.
