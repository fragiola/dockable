# Dockable

A **headless** layout manager for dockable panels: tabs, tabsets, splitters,
borders and popout windows. It ships behaviour, accessibility and
composable primitives. It ships **no CSS, no icons, no rendered menus and no
text**. Styling belongs 100% to the consuming developer; the package never
assumes Tailwind, shadcn, daisy or anything else.

This repo is the first of a family (Angular and Vue adapters will follow), so
**every piece of logic that isn't rendering lives in the core**.

| package | name | contains | depends on |
|---|---|---|---|
| `packages/core` | `@fragiola/dockable` | the typed model and its command bus, JSON v1 and its JSON Schemas, drop hit-testing, splitter math, the measure-and-position cycle, the drag-and-drop machine, popout window lifecycle | DOM only |
| `packages/react` | `@fragiola/dockable-react` | composable primitives over the core, and the whole core re-exported (`export *`): the one package a React app installs and imports from | the core (`workspace:*`, published as the exact version); peer `react`, `react-dom` (^19) |
| `apps/playground` | private | the dev app (every site example live, with themes and source), unstyled fixture pages driven by Playwright, `popout.html` | `@fragiola/dockable-react` (the core through it), `examples/react` |

## Non-negotiable rules

Do not "fix" these.

1. **Geometry follows FlexLayout.** Tabsets and rows use normal CSS flex, with
   `flexGrow` proportional to `weight`. Content panels are `position: absolute`,
   positioned imperatively by the core over the measured content area. User
   content lives in a **moveable element** re-parented with `appendChild`, so it
   survives moves between tabsets, borders and popouts. The **only inline style a
   primitive applies is structural**: `position`, `inset`/`left`/`top`/`width`/
   `height`, `display: none`, flex sizing and indicator position. Nothing cosmetic.
   **Maximize (deviation from FlexLayout):** FlexLayout portals the maximized tabset over the
   layout; Dockable hides every tabset and row off its path
   (`model.is("node-hidden-by-maximize", { nodeId })`, `display: none`), so nothing remounts.
2. **Public API is composable primitives under one namespace** (`Dockable.Root`,
   `Row`, `TabSet`, `TabList`, `Tab`, `Panel`, `Splitter`, …). Hooks
   (`useDockable`, `useTabSet`, `useSplitter`, `useDragNode`) are exported as the
   lower layer.
3. **Polymorphism uses the `render` prop, never `asChild`.**
4. **State is exposed only via `data-*`** (`data-selected`, `data-active`,
   `data-maximized`, `data-orientation`, `data-dragging`, `data-drop-location`,
   `data-pinned`, …) and ARIA. Boolean `data-*` are present or absent, never
   `"false"`.
5. **Menus:** the package provides commands and their `model.can` answers (a boolean;
   `model.check` says why), never a rendered menu.
6. **Buttons and icons:** each button is a primitive that takes `children`.
7. **The model is the source of truth.** Every change is a command (`model.run` /
   `model.dispatch`) through the middleware chain (`model.use`); nodes are immutable.
8. **No translation in the model (D3).** Names are returned raw. The packages
   ship no label keys and no label resolver: every accessible name comes from the
   consumer, as a prop on the element it names (`aria-label`, children, or
   `render` with the part's state). With none, no text and no name is rendered.
   A tab's `label` is model data like any other: the model stores the raw string
   (required, `tab.configure` changes it), and no primitive reads or renders it;
   the consumer writes `{tab.label}`.
9. **No CSS class names in core (D6).** Drop kinds are semantic
   (`kind: "rect" | "edge"`); the moveable element carries
   `data-dockable-moveable`.
10. **The core never touches global `document`/`window`.** All DOM access goes
    through the root element's `ownerDocument`/`defaultView` (or an injected
    host), so the same engine runs inside a popout window and the model loads
    in plain Node.
11. **The core has zero runtime dependencies** and never imports `react`,
    `react-dom` or React types. A guard test enforces it.
12. **App policy stays in the app.** The packages ship no undo/redo, no translations and no
    persistence. They expose the model, its commands, its middleware and its events; the examples
    show how to build those features (`examples/react/src/examples/_kit/undo.ts` is copyable code,
    not part of a package).
13. **One pattern on the model and the engine** (`site/docs/concepts/model-and-engine.mdx`). The
    model is the layout's data and its rules; an engine is one layout on screen (one per window).
    Both have the same verbs, each taking a key and a payload: `run` (do), `can` (a boolean),
    `check` (the dry-run result), `get` (read), `is` (yes/no). Keys are kebab-case and typed by a
    registry (`src/state/queries.ts`, `src/engine/verbs.ts`); a command name has a dot
    (`tab.close`), an engine action never does (`popout`). Only `model.run` changes the layout.
    Everything only an adapter calls is under `engine.adapter`; an app (and every example) never
    touches it, and never needs the main engine: page-wide actions work from any engine. A new
    read or question is a new key, not a new method; guard tests keep both surfaces exact.
    **Names say what they take.** A field holding an id is `<entity>Id` (`tabId`, `tabsetId`,
    `nodeId`, `layoutId`; a list `tabIds`), in every payload and result, commands included; only
    `to` (a placement target) and an entity's own `id` (a new node's, or the one a `get` key
    returns) are exempt. **A key and its payload read as one sentence**
    (`model.can("tab.move", { tabId, to: "main" })`). A `get` key names its result; one that takes
    an id ends in `-by` and the payload's field completes it: `id` when it is the id of what the
    key returns (`node-by { id }`, `window-by { id }`), `<entity>Id` otherwise
    (`node-parent-by { nodeId }`, `layout-id-by { nodeId }`, `tab-settings-by { tabId }`);
    `selected-tab-by` takes exactly one of `{ tabsetId }`, `{ borderId }`, `{ layoutId }`. A key
    whose only input is an optional `layoutId` has no `-by` and defaults to the main layout
    (`tabsets`, `active-tabset`); one that takes nothing has a plain name (`all-tabs`). Never
    `-by-<entity>-id`. An `is` key is `<entity>-<state>` (`tabset-active { tabsetId }`). A tab is
    **selected** (the one its tabset or border shows); a tabset is **active** (one per layout);
    the two words are never swapped.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm check` | Biome lint + format + assist (non-mutating), then builds the core and checks that `site/docs/api/commands.mdx` matches the registry (`check:commands`) |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit) |
| `pnpm test` | Vitest: `core` (node), `react` (jsdom), `playground`, `examples-react`, `site` |
| `pnpm build` | `pnpm -r build` (tsdown for the packages, Vite for the playground) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition (only `types`/`import`/`default`, targets in `dist`), runs `publint` and `attw --profile esm-only` on the tarballs, checks the React package pins the core's exact version, then a smoke test: a scratch Vite + React app outside the workspace installs the React tarball only (the core comes as its dependency), typechecks, builds and loads its dev server (`scripts/check-package.ts`; with `--tarballs <dir>` it checks the tarballs in `dir` instead of packing, which the release workflow does on what `changeset pack` wrote) |
| `pnpm changeset` | adds a changeset (`.changeset/*.md`): every PR that changes what a package ships carries one; the two packages are one `fixed` group, so they always share a version |
| `pnpm release:version` | `changeset version`: bumps both packages and writes their `CHANGELOG.md`. Only the release workflow runs it (the Version Packages PR); never commit a version bump by hand |
| `pnpm e2e` | Playwright (Chromium) against the playground and the examples app |
| `pnpm dev` | the playground on <http://localhost:5173>: every example and scenario live, the Inspector, the fixtures (`PLAYGROUND_PORT` moves it) |
| `pnpm site:export --base /dockable --out <dir>` | the site export for fragiola.com (contract v1.2, `../www/CONTRACT.md`), self-validated |
| `pnpm site:dev --base /dockable --port <n>` | the examples app with hot reload, under the base `www` proxies in dev |

Releasing is a merge: `.github/workflows/release.yml` opens the Version Packages PR, and merging it
publishes both packages with pnpm through npm trusted publishing (OIDC, no token). After the
maintainer's first `0.0.0` stub, nobody but that workflow publishes; the maintainer's steps are in
[`docs/releasing.md`](docs/releasing.md).

## Repository layout

```
packages/core/      @fragiola/dockable        src/, tests/
packages/react/     @fragiola/dockable-react  src/, tests/
apps/playground/    src/                      the shell: catalog, sidebar, toolbar, stage, source
                    src/scenarios/<area>/     dev-only scenarios; src/inspector/ the Inspector
                    fixtures/<name>/          unstyled pages Playwright drives
                    public/popout.html        popout host page
                    e2e/, tests/              Playwright specs, unit tests
examples/react/     src/examples/<slug>/      the site's examples (the embed app, Vite)
                    src/components, lib, …    Fragiola UI, vendored (scripts/vendor-fragiola.ts)
                    e2e/                      Playwright specs, also inside an iframe
site/               docs/                     the pages fragiola.com/dockable serves
                    export.ts, contract.ts    `pnpm site:export` and its validation
docs/                                         reports
```

## The site (fragiola.com)

The docs and examples are served by `fragiola.com`, built by the `www` repo from this repo's
**site export** (`../www/CONTRACT.md`, v1.2). This repo only provides: the pages (`site/docs`,
base-free links, the v1.1 MDX vocabulary), the gallery configuration (`examples.json`) and the
examples app (`examples/react`, built for `<base>/embed/react/`). `www` owns the shell, the
gallery chrome, the code panel and search. Examples import internal modules through `#/…`
(never `@/…`).

v1.2 is about search and sharing, and `site:export` checks it: a page's `title` is at most 60
characters and never repeats "Dockable" (`www` adds it); its `description` is 50–160 characters
and is also the page's visible lead, so it is written for a reader, not as a list of terms; a
page body has no Markdown `#` (the title is the h1) and never skips a heading level (a page
starts at `##`; a `<Card>` is an h3); headings are written as `##` at the start of a line (no
setext, none in a blockquote or list); every image has alt text. Frontmatter is one
`key: value` per line, and a description is counted without its inline code marks. The
landing's `title` is its `<title>` as is ("Dockable — …"). `project.json` carries `keywords`
(1–8 lowercase topics, structured data only). Every HTML file of the examples app (`index.html`, `public/popout.html`) carries
`<meta name="robots" content="noindex">`.

In dev the playground resolves both packages to their sources through the
`@fragiola/source` export condition (`SOURCE_CONDITION` in `scripts/source-condition.ts`, the
tsconfigs' `customConditions`, the Vitest configs); production builds use `dist`. The published
`exports` (`publishConfig.exports`) are dist-only, and only pnpm applies them: the packages are
packed and published through pnpm, never npm.

## Playground

`pnpm dev` serves `apps/playground`: a local app to see the packages working, with hot reload on
the core, the React primitives, the examples and the scenarios, and no `www`, sync or export. A
sidebar, a theme switch (the five example themes), the source beside the stage and the Inspector;
the state is in the URL (`?example=<slug>` or `?scenario=<area>/<id>`, `&theme=<name>&code=1&inspect=1`).
It shows three things, which are not interchangeable:

- **Examples** live in `examples/react/src/examples` and are public: the site embeds them,
  `site:export` ships them, readers copy them. The playground reads them in place
  (`import.meta.glob`, the `#/` alias and the pre-paint theme from `examples/react/vite.shared.ts`);
  it never keeps a second list. The stage follows the embed's contract (`data-example-theme` on
  `<body>`, the scheme on `<html>`, `fill`/`flow`), so an example renders as the site shows it; the
  shell keeps its own palette (`palette-shell`), which no example theme overrides.
- **Scenarios** live in `apps/playground/src/scenarios/<area>/<id>.tsx` and are dev-only: new
  primitives, edge cases, animations, API experiments; never shipped, never linked from
  `site/docs`. A file is all it takes: `<area>` is one of `AREAS` in `src/catalog.ts` (`layout`,
  `drag`, `borders`, `popout`, `api`), `<id>` is kebab-case, and the module has **only a default
  export** (anything else costs Fast Refresh); `tests/scenarios.test.ts` enforces it. A scenario
  may import `#/examples/_kit/*` (shared demo content: cards, charts, data) and `#/components/*`,
  and writes its own Dockable assembly, as the examples do. When readers should see it, it becomes an
  example in `examples/react`.
- **Fixtures** (`fixtures/<name>/`) are the unstyled pages Playwright drives; the sidebar links
  them.

**The Inspector** (`src/inspector/`, app code, never in a package): a scenario calls
`useInspector(model)` and the toolbar offers a panel with every command the model commits
(`model.subscribe`, engine-issued and direct alike: name, payload, result, transient),
`model.get("layout-json")` after the last one, and every `[data-layout-path]` element of the stage with its `data-*`/ARIA
attributes, live during a drag. Examples do not call it.

## Provenance: FlexLayout

The source and reference is [caplin/FlexLayout](https://github.com/caplin/FlexLayout)
(`flexlayout-react` 0.11.0, MIT, © 2017 Caplin Systems Ltd), checked out at
`../FlexLayout`. **`../FlexLayout` is read-only: never modify it.**

- The model is Dockable's own (`src/state`, `src/commands`, `src/schema`). The ported
  algorithms (tidy, selection, docking, drop resolution, splitter math, the engine, drag and
  drop, popouts, keyboard, paths) keep a header naming FlexLayout, Caplin Systems Ltd
  and the MIT licence; `packages/core/tests/guard.test.ts` lists them.
- The root `LICENSE` carries Caplin's full notice; each package ships a copy.
- FlexLayout's tests and `tests-playwright/` remain the behaviour reference, ported gradually;
  the view is rewritten as primitives.
- The `data-layout-path` scheme (`/r1/ts0`, `/ts0/tb1`, `/ts0/t0`, `/s0`, …) is
  kept. Every primitive emits it; e2e selectors use it, never class names.

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
  Do not relax it; a blanket `!` on every index access is not a fix.
- Pin dependencies to exact versions published at least 7 days ago.
- Commits are gitmoji-conventional: `✨ feat(core): …`, `🐛 fix(react): …`,
  `✅ test(core): …`, `🔧 chore: …`, `📝 docs: …`.

## Type safety

- **No `any` in public types.** A guard test checks the core's exported declarations, and
  `pnpm build` checks every package's emitted `.d.ts` (`scripts/check-dts.ts`).
- **Data is typed by the registry.** An app declares `Types` (`{ tabs: { editor: {…} } }`) and
  `createModel<Types>`; `tab.data` narrows on `tab.component`, and `tab.add`/`tab.set-data`/
  `tab.set-component` payloads are checked against it. Parts that hand nodes to a children function take the
  registry as a type argument (`<Dockable.Panels<Types>>`). No casts on node data or kinds, in
  the packages or the examples.
- **Schemas and types are tested together.** Every command's payload and result schema, and the
  layout schema, is checked equal to its TypeScript type (`packages/core/tests/types/schemas.ts`).
- **Type fixtures** go in `tests/types/` (checked by `tsc`, not run): `@ts-expect-error` marks
  what must not compile.
- `site/docs/api/commands.mdx` is generated from the registry
  (`packages/core/scripts/generate-command-docs.ts`); `pnpm check` fails when it drifts.

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
  `flex-grow`, `flex-shrink`, `min-*`/`max-*`), `overflow: hidden` on rows and tabsets, the
  splitter's preview `transform`, and `pointer-events` where it is hit-testing (`none` on the drop
  and edge indicators and an overlay border's content, `auto` on a border's splitter).
- **State only through `data-*` and ARIA**, present or absent (never `"false"`):
  `data-selected`, `data-active`, `data-maximized`, `data-orientation`, `data-dragging`,
  `data-pinned`, `data-visible`, `data-empty`, `data-root`, and on borders `data-location`,
  `data-open`, `data-overlay`/`data-docked`, `data-tab-direction`.
- **`data-layout-path` on every element**: `/layout` (Root), `/row` (root row), `/r0`, `/ts0`,
  `/ts0/tabstrip`, `/ts0/content`, `/ts0/tb0`, `/ts0/t0`, `/s0`; with borders `/borders`, `/main`,
  `/border/left`, `/border/left/tb0`, `/border/left/content`, `/border/left/s-1`; `/edge/top`.
- **No text and no names.** Primitives render only their children and set no `aria-label` of
  their own. Accessible names come from the consumer (`aria-label`, children, `render` with state);
  the splitters a `Row` or a border inserts are named through `renderSplitter`.
- **Hooks have one shape.** `useDockable()` is `{ model, engine, layoutId }`. A part hook
  (`useTabSet`, `useBorder`, `useSplitter`, `useDragNode`, `useDragSource`, `useDropZone`) takes
  the node (or an options object with the model) and returns `{ state, props }`: what the part
  shows, and what goes on its element. A hook that wires no element returns its value.
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
- **Stacking is the consumer's.** Panels are portalled into the root after its other
  children, so an absolutely positioned `DropIndicator` needs a `z-index` to paint above them
  (the playground gives it one).
- **Drops run commands:** `tab.move` / `tabset.move` (or `tab.add` for a new tab) through the
  model's middleware. A drag carries `DRAG_TYPE` (`application/x-dockable`); refusals come from
  `model.can` during the hover (the outline hides, `data-drop-refused` shows).
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
- **Close policy (deviation from FlexLayout).** FlexLayout turns a closed popout into a float.
  Floats are not built, so the only policy is `"dock"`: closing the window runs `window.close`,
  which moves its tabs into the main layout's active tabset (else its first).
- Nothing names or titles the window unless the consumer passes a title.
- The host page (`popoutURL`, default `popout.html`) receives the layout id as `?id=`.
