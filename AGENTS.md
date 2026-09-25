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

## The primitive contract (`@fragiola/dockable-react`)

Every primitive (`Dockable.Root`, `Row`, `TabSet`, `TabList`, `Tab`, `TabSetContent`, `Panel`,
`Splitter`, …) follows the same rules. Tests enforce them; keep it that way.

- **`render`, never `asChild`.** `render={<section />}` merges the primitive's props into the
  element; `render={(props, state) => …}` receives them plus the state.
- **`ref` is a plain prop** (React 19) and is merged with the primitive's own.
- **Arbitrary props are forwarded.** Consumer handlers compose with the internal ones: internal
  first, then the consumer's.
- **`className` and `style` accept a value or a `(state) => value` function.** Consumer style is
  merged *under* the structural style: structural keys always win. On `Panel`, the engine owns
  `position`/geometry/`display`, so those keys are dropped from the consumer's style.
- **Structural inline style only**: `position`, `inset`/`left`/`top`/`width`/`height`,
  `display` (`flex`, or `none` to hide), flex sizing (`flex-direction`, `flex-basis`,
  `flex-grow`, `min-*`/`max-*`), `overflow: hidden` on rows and tabsets, and the splitter's
  preview `transform`.
- **State only through `data-*` and ARIA**, present or absent (never `"false"`):
  `data-selected`, `data-active`, `data-maximized`, `data-orientation`, `data-dragging`,
  `data-pinned`, `data-visible`, `data-empty`, `data-root`.
- **`data-layout-path` on every element**: `/layout` (Root), `/row` (root row), `/r0`, `/ts0`,
  `/ts0/tabstrip`, `/ts0/content`, `/ts0/tb0`, `/ts0/t0`, `/s0`.
- **No text.** Primitives render only their children. Accessible names come from the consumer
  (`aria-label`, children) or from `getLabel(key)` on `Dockable.Root`.
- **The developer owns the recursion** (children functions: `Row`, `TabList`, `Panels`). `Row`
  inserts splitters itself (`renderSplitter` / `splitter={false}` to override).
- **React never reconciles what the engine writes.** Panels get geometry from the engine after
  commit, never through props. Content renders through a portal into the tab's moveable element;
  the moveable is re-parented by the engine, so moving a tab never remounts its content.

## Drag and drop contract

- **The state machine lives in the core** (`DragDropManager`, one per engine). The page-wide
  `DragState` is static, so a drag can cross layouts and windows of the same model.
- **The engine attaches native `dragenter`/`dragover`/`dragleave`/`drop` listeners to its root**
  (not framework events), so the same path works in a popout document.
- **Visual state is data, not DOM.** Each engine exposes a subscribable drop indicator state
  (`visible`, `rect`, `location`, `kind: "rect" | "edge"`, `dragging`, `showEdges`,
  `tabDragSpeed`). `Dockable.DropIndicator` renders it: structural position, `display: none`
  when hidden, `pointer-events: none` (an indicator under the pointer would steal the drag's
  enter/leave events), and `data-drop-location` / `data-drop-kind` / `data-dragging`.
- **Drops dispatch `Actions.moveNode`** (or `dockFloatToLayout`) through `onAction`.
- **No text in drag images.** The drag image is an element the adapter provides (the dragged
  `Dockable.Tab` by default); with none, the browser default is used.
- `data-dragging` marks the dragged `Tab` and the `Root` while a drag of the layout is active.

## Popout contract

- **The core owns the windows** (`PopoutManager`, owned by the main engine): `window.open`
  (idempotent per layout; a release is deferred so a StrictMode remount keeps one window), the
  load sequence (rect convergence, `lang`/`dir`, the `data-dockable-popout` content root,
  `onPopoutOpen`), style mirroring (`<link>`, `<style>` including in-place edits, CSSOM rules
  polled, `adoptedStyleSheets`), the close paths, and a sub-engine per window layout.
- **React only portals** into the content root once it is ready (`Dockable.Popout`), and the
  moveable elements are re-parented across documents with `appendChild` (never cloned), so the
  content keeps its state.
- **Close policy (deviation from FlexLayout).** FlexLayout's `Actions.closePopout` turns a closed
  popout into a float. Floats are a later slice, so the default policy here is `"dock"`: closing
  the window moves its tabs into the main layout's active tabset (else its first). The
  `"float"` policy (FlexLayout parity) exists and is tested; the float slice flips the default.
- Nothing names or titles the window unless the consumer passes a title.
- The host page (`popoutURL`, default `popout.html`) receives the layout id as `?id=`.
