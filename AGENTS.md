# Dockable

A **headless** layout manager for dockable panels: tabs, tabsets, splitters,
borders, float and popout windows. It ships behaviour, accessibility and
composable primitives. It ships **no CSS, no icons, no rendered menus and no
text**. Styling belongs 100% to the consuming developer; the package never
assumes Tailwind, shadcn, daisy or anything else.

This repo is the first of a family (Angular and Vue adapters will follow), so
**every piece of logic that isn't rendering lives in the core**.

| package | name | contains | depends on |
|---|---|---|---|
| `packages/core` | `@fragiola/dockable` | model, actions, JSON serialization, drop hit-testing, splitter math, the measure-and-position cycle, the drag-and-drop machine, popout window lifecycle, undo/redo | DOM only |
| `packages/react` | `@fragiola/dockable-react` | composable primitives over the core | peer `react`, `react-dom` (^19) |
| `apps/playground` | private | unstyled fixture pages driven by Playwright, `popout.html`, styled examples | both packages |

## Non-negotiable rules

Do not "fix" these.

1. **Geometry follows FlexLayout.** Tabsets and rows use normal CSS flex, with
   `flexGrow` proportional to `weight`. Content panels are `position: absolute`,
   positioned imperatively by the core over the measured content area. User
   content lives in a **moveable element** re-parented with `appendChild`, so it
   survives moves between tabsets, floats and popouts. The **only inline style a
   primitive applies is structural**: `position`, `inset`/`left`/`top`/`width`/
   `height`, `display: none`, flex sizing and indicator position. Nothing cosmetic.
2. **Public API is composable primitives under one namespace** (`Dockable.Root`,
   `Row`, `TabSet`, `TabList`, `Tab`, `Panel`, `Splitter`, …). Hooks
   (`useDockable`, `useTabSet`, `useSplitter`, `useDragNode`) are exported as the
   lower layer.
3. **Polymorphism uses the `render` prop, never `asChild`.**
4. **State is exposed only via `data-*`** (`data-selected`, `data-active`,
   `data-maximized`, `data-orientation`, `data-dragging`, `data-drop-location`,
   `data-pinned`, …) and ARIA. Boolean `data-*` are present or absent, never
   `"false"`.
5. **Menus:** the package provides items and actions, never a rendered menu.
6. **Buttons and icons:** each button is a primitive that takes `children`.
7. **The model is the source of truth.** Every change goes through
   `model.doAction(Actions.x)` (via the engine, interceptable by `onAction`).
   Nodes are never mutated directly.
8. **No translation in the model (D3).** Names are returned raw. The i18n keys
   survive only as the `DockableLabel` key enum with no default strings.
   Accessible names come from the consumer (`aria-label`/children, or
   `getLabel(key)` on `Dockable.Root`). With neither, no text is rendered.
9. **No CSS class names in core (D6).** Drop kinds are semantic
   (`kind: "rect" | "edge"`); the moveable element carries
   `data-dockable-moveable`.
10. **The core never touches global `document`/`window`.** All DOM access goes
    through the root element's `ownerDocument`/`defaultView` (or an injected
    host), so the same engine runs inside a popout window and the model loads
    in plain Node.
11. **The core has zero runtime dependencies** and never imports `react`,
    `react-dom` or React types. A guard test enforces it.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm check` | Biome lint + format + assist (non-mutating) |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit) |
| `pnpm test` | Vitest, both projects (`core` in node, `react` in jsdom) |
| `pnpm build` | `pnpm -r build` (tsdown for the packages, Vite for the playground) |
| `pnpm e2e` | Playwright (Chromium) against the playground |
| `pnpm dev` | playground dev server on <http://localhost:5173> |

## Repository layout

```
packages/core/      @fragiola/dockable        src/, tests/
packages/react/     @fragiola/dockable-react  src/, tests/
apps/playground/    fixtures/<name>/          unstyled pages Playwright drives
                    examples/<name>/          styled examples
                    public/popout.html        popout host page
                    e2e/                      Playwright specs
docs/                                         reports
```

In dev the playground resolves both packages to their sources through the
`development` export condition; production builds use `dist`.

## Provenance: FlexLayout

The source and reference is [caplin/FlexLayout](https://github.com/caplin/FlexLayout)
(`flexlayout-react` 0.11.0, MIT, © 2017 Caplin Systems Ltd), checked out at
`../FlexLayout`. **`../FlexLayout` is read-only: never modify it.**

- Every copied or ported file keeps a header naming FlexLayout, Caplin Systems
  Ltd and the MIT licence.
- The root `LICENSE` carries Caplin's full notice; each package ships a copy.
- The model (`src/model/`) is reused almost entirely; the view is rewritten as
  primitives. `tests-playwright/` is the behaviour specification, ported
  gradually.
- The `data-layout-path` scheme (`/r1/ts0`, `/ts0/tb1`, `/ts0/t0`, `/s0`, …) is
  kept. Every primitive emits it; e2e selectors use it, never class names.

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
  Do not relax it; a blanket `!` on every index access is not a fix.
- Pin dependencies to exact versions published at least 7 days ago.
- Commits are gitmoji-conventional: `✨ feat(core): …`, `🐛 fix(react): …`,
  `✅ test(core): …`, `🔧 chore: …`, `📝 docs: …`.
