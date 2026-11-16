# Dockable

A **headless** layout manager for dockable panels: tabs, tabsets, splitters,
borders and popout windows. It ships behaviour, accessibility and
composable primitives. It ships **no CSS, no icons, no rendered menus and no
text**. Styling belongs 100% to the consuming developer; the package never
assumes Tailwind, shadcn, daisy or anything else.

This repo is the first of a family (React, Vue and Angular today), so
**every piece of logic that isn't rendering lives in the core**.

| package | name | contains | depends on |
|---|---|---|---|
| `packages/core` | `@fragiola/dockable` | the typed model and its command bus, JSON v1 and its JSON Schemas, drop hit-testing, splitter math, the measure-and-position cycle, the drag-and-drop machine, popout window lifecycle | DOM only |
| `packages/react` | `@fragiola/dockable-react` | composable primitives over the core, and the whole core re-exported (`export *`): the one package a React app installs and imports from | the core (`workspace:*`, published as the exact version); peer `react`, `react-dom` (^19) |
| `packages/vue` | `@fragiola/dockable-vue` | the same primitives as Vue 3 components (plain `.ts` render functions, no SFCs: tsdown builds them with TypeScript 7) and composables, and the whole core re-exported: the one package a Vue app installs | the core (`workspace:*`, published as the exact version); peer `vue` (^3.5) |
| `packages/angular` | `@fragiola/dockable-angular` | the same primitives as Angular standalone attribute directives on the consumer's elements (signals, `host` bindings, zoneless), template directives for the recursion, injection functions, and the whole core re-exported: the one package an Angular app installs. Built by ng-packagr (Angular Package Format, partial compilation, ESM only) on TypeScript 6.0.3, pinned in this package (the Angular compiler supports `>=6.0 <6.1`); published from its `dist` (`publishConfig.directory`, its manifest written by `scripts/publish-manifest.ts`) | the core (`workspace:*`, published as the exact version); peer `@angular/core` (^22) |
| `apps/playground` | private | the dev app (every site example live, with themes and source), unstyled fixture pages driven by Playwright, `popout.html` | `@fragiola/dockable-react` (the core through it), `examples/react`, `examples-shared` |
| `examples/react` | private, `examples-react` | the React examples of the site (the embed app, Vite): only what a reader copies | `@fragiola/dockable-react`, `examples-shared` |
| `examples/vue` | private, `examples-vue` | the Vue examples of the site (the embed app, Vite, single-file components typechecked by `vue-tsc` on TypeScript 6.0.3, pinned in this app only): every React one, with a kit of its own (`src/components`: Fragiola UI's pieces over Reka UI, the React kit's classes) | `@fragiola/dockable-vue`, `examples-shared` |
| `examples/angular` | private, `examples-angular` | the Angular examples of the site (the embed app, Vite with `@analogjs/vite-plugin-angular`, zoneless, standalone components with inline templates, typechecked by `ngc` on TypeScript 6.0.3, pinned in this app only): every React one, with a kit of its own (`src/components`: Fragiola UI's pieces over Angular CDK, the React kit's classes); `src/styles`, `src/lib` and the class families copied from examples/react (tests/vendored.test.ts) | `@fragiola/dockable-angular`, `examples-shared` |
| `examples/shared` | private, `examples-shared` | what every framework's examples share and no reader copies: each example's metadata, the themes, the embed protocol, the manifest builder, the loader generator, every e2e spec | no framework (a test enforces it) |

A framework app is `examples/<framework>` (package `examples-<framework>`; `Framework` is
`"react" | "vue" | "angular"` in `examples/shared/src/framework.ts`), with the scripts `generate`,
`dev` (`EMBED_BASE`, `PORT`), `build` (`EMBED_BASE`, `EMBED_OUT_DIR`), `typecheck` and `e2e`
(`playwright.config.ts` is `examplesE2eConfig("<framework>")`). An adapter is `packages/<framework>`
with its entry in `ADAPTERS` (`scripts/check-package.ts`).

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
   (required, `tab.rename` changes it), and no primitive reads or renders it;
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
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit; `examples/vue` runs `vue-tsc` on its own TypeScript 6.0.3; `packages/angular` and `examples/angular` run `ngc` with strict templates on their own TypeScript 6.0.3) |
| `pnpm test` | Vitest: `core` (node), `react` (jsdom), `vue` (jsdom, `@vue/test-utils`), `angular` (jsdom, `@analogjs/vitest-angular`, zoneless TestBed), `playground`, `examples-shared`, `examples-react`, `examples-vue`, `examples-angular`, `site` |
| `pnpm build` | `pnpm -r build` (tsdown for the packages, ng-packagr for the Angular one, Vite for the playground), then `scripts/check-dts.ts` (no `any` in the built declarations; the Angular compiler's `ɵ` metadata is ignored) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition (only `types`/`import`/`default`, targets in `dist`; a package packed from its `publishConfig.directory`, the Angular one, has them relative to it, each a file of the tarball), runs `publint` and `attw --profile esm-only` on the tarballs, then for each adapter of `ADAPTERS` (every package but the core: React, Vue and Angular) checks it pins the core's exact version and runs its smoke test: a scratch app outside the workspace (Vite + React for React; Vite + Vue with a single-file component checked by `vue-tsc` for Vue; Vite + `@analogjs/vite-plugin-angular` with a standalone component checked by `ngc` for Angular) installs that adapter's tarball only (the core comes as its dependency), typechecks, builds and loads its dev server (`scripts/check-package.ts`; with `--tarballs <dir>` it checks the tarballs in `dir` instead of packing, which the release workflow does on what `changeset pack` wrote) |
| `pnpm changeset` | adds a changeset (`.changeset/*.md`): every PR that changes what a package ships (`changedFilePatterns` in `.changeset/config.json`) carries one, and CI's Changesets job fails one that does not; every package is in one `fixed` group (`@fragiola/*`), so they always share a version |
| `pnpm release:version` | `changeset version`: bumps every package and writes their `CHANGELOG.md`. Only the release workflow runs it (the Version Packages PR); never commit a version bump by hand |
| `pnpm e2e` | Playwright (Chromium) against the playground, then the shared examples specs (`examples/shared/e2e`) against each framework's examples app, one after the other |
| `pnpm --filter examples-vue dev` | the Vue examples app alone on <http://localhost:5181> (`?id=<slug>&theme=<name>`; `PORT` moves it). `pnpm --filter examples-react dev` is the React one (5180), `pnpm --filter examples-angular dev` the Angular one (5182) |
| `pnpm dev` | the playground on <http://localhost:5173>: every example and scenario live, the Inspector, the fixtures (`PLAYGROUND_PORT` moves it) |
| `pnpm site:export --base /dockable --out <dir>` | the site export for fragiola.com (contract v1.2, `../www/CONTRACT.md`), self-validated: one embed and one manifest per framework of `site/project.json` |
| `pnpm site:dev --base /dockable --port <n>` | every framework's examples app with hot reload, under the base `www` proxies in dev: one Vite dev server per framework on a free port, behind a Node proxy on `--port` (`site/dev-proxy.ts`) |

Releasing is a merge: `.github/workflows/release.yml` opens the Version Packages PR, and merging it
publishes every package with pnpm through npm trusted publishing (OIDC, no token). After the
maintainer's first `0.0.0` stub, nobody but that workflow publishes; the maintainer's steps,
including a new package's own stub and trust, are in [`docs/releasing.md`](docs/releasing.md).

## Repository layout

```
packages/core/      @fragiola/dockable        src/, tests/
packages/react/     @fragiola/dockable-react  src/index.ts, src/parts.ts (the Dockable namespace), src/context.ts
                    src/components/           one primitive per file (root.tsx, tabset.tsx, tab-list.tsx, …)
                    src/hooks/                one public hook per file (use-tabset.ts, …); internal.ts
                                              holds the hooks only the primitives call
                    src/utils/                merge-props.ts, use-render.ts (the render prop)
                    tests/
packages/vue/       @fragiola/dockable-vue    plain .ts, render functions: src/index.ts, src/parts.ts,
                                              src/typed.ts (typedDockable), src/context.ts
                    src/components/           one primitive per file (root.ts, tabset.ts, tab-list.ts, …)
                    src/composables/          one public composable per file (use-tabset.ts, …);
                                              internal.ts holds the ones only the primitives call
                    src/utils/                primitive.ts, registration.ts, render.ts
                    tests/
packages/angular/   @fragiola/dockable-angular  src/public-api.ts, src/lib/dockable.ts (the DOCKABLE
                                              array), src/lib/context.ts (the tokens)
                    src/lib/directives/       one file per primitive family (root.directive.ts, …);
                                              templates.directive.ts holds the template directives
                    src/lib/inject/           the injection functions (inject-part.ts: the parts')
                    src/lib/utils/            helpers.ts, signals.ts (the engine's signals), views.ts
                    tests/, scripts/publish-manifest.ts
apps/playground/    src/                      the shell: catalog, sidebar, toolbar, stage, source
                    src/scenarios/<area>/     dev-only scenarios; src/inspector/ the Inspector
                    fixtures/<name>/          unstyled pages Playwright drives
                    public/popout.html        popout host page
                    e2e/, tests/              Playwright specs, unit tests
examples/react/     src/examples/<slug>/      the site's React examples (the embed app, Vite)
                    src/components, lib, …    Fragiola UI, vendored (scripts/vendor-fragiola.ts)
examples/vue/       src/examples/<slug>/      the site's Vue examples: index.vue (+ SFCs, styles.ts)
                    src/styles, src/lib       copied from examples/react (tests/vendored.test.ts)
                    src/components            the kit: Fragiola UI's pieces over Reka UI (class
                                              families copied from examples/react)
examples/angular/   src/examples/<slug>/      the site's Angular examples: index.ts (a standalone
                                              component, default-exported, inline template), styles.ts
                    src/styles, src/lib       copied from examples/react (tests/vendored.test.ts)
                    src/components            the kit: Fragiola UI's pieces over Angular CDK (class
                                              families copied from examples/react; popups open in
                                              their trigger's document, components/floating.ts)
examples/shared/    src/meta/<slug>.ts        each example's metadata, for every framework
                    src/themes/, src/embed/   the themes; the embed's messages to the site
                    scripts/                  examples finder, manifest builder, loader generator
                    e2e/                      every Playwright spec, run against each framework's
                                              embed (also inside an iframe)
site/               docs/                     the pages fragiola.com/dockable serves
                    export.ts, contract.ts    `pnpm site:export` and its validation
                    dev.ts, dev-proxy.ts      `pnpm site:dev`: one port for every framework
docs/                                         reports
```

## The site (fragiola.com)

The docs and examples are served by `fragiola.com`, built by the `www` repo from this repo's
**site export** (`../www/CONTRACT.md`, v1.2). This repo only provides: the pages (`site/docs`,
base-free links, the v1.1 MDX vocabulary; `<Framework name="vue">` and `<Framework name="angular">`
blocks where the code differs),
the gallery configuration (`examples.json`) and one examples app per framework of
`site/project.json` (`examples/react`, `examples/vue` and `examples/angular`, built for
`<base>/embed/<framework>/`). Every framework's app shares one metadata source and one e2e suite
(`examples/shared`): an example has the same id in every framework, and a framework may ship a
subset of them while it is being written (the specs of an example it lacks are skipped); React,
Vue and Angular ship every one (`COMPLETE_FRAMEWORKS`: a spec of an example they lack fails). `www` owns the shell, the
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
  `site:export` ships them, readers copy them. The playground reads them in place, with their
  metadata from `examples/shared/src/meta` (`import.meta.glob`, the `#/` alias and the pre-paint
  theme from `examples/react/vite.shared.ts`); it never keeps a second list. It stays React-only. The stage follows the embed's contract (`data-example-theme` on
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
- The adapters' sources are kebab-case files grouped by responsibility (components or directives,
  hooks / composables / injection functions, utils; "Repository layout"): a primitive has the same
  file name in React and Vue (Angular's keep the `.directive.ts` suffix), and an entry imports each
  module directly (no barrel files).
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
  Do not relax it; a blanket `!` on every index access is not a fix.
- Pin dependencies to exact versions published at least 7 days ago.
- TypeScript is 7.0.2 everywhere but `examples/vue`, `packages/angular` and `examples/angular`,
  which pin 6.0.3 (vue-tsc and the Angular compiler do not run on TypeScript 7). In the Angular
  folders `@analogjs/vite-plugin-angular` gets that TypeScript through a `packageExtensions` peer
  (`pnpm-workspace.yaml`).
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

## The primitive contract (`@fragiola/dockable-react`, `@fragiola/dockable-vue`, `@fragiola/dockable-angular`)

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
  `/border/start`, `/border/start/tb0`, `/border/start/content`, `/border/start/s-1`; `/edge/top`,
  `/edge/start`. Sides are logical (`top`, `bottom`, `start`, `end`), never `left`/`right`.
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
- **The adapter forwards events; the core decides.** The tab strip's keys, a tab or tabset press,
  the panel's focus key, the document keys, `aria-keyshortcuts`, `draggable` and the drop state of
  a container are `engine.adapter` keys (`handleTabKeyDown`, `handleTabClick`, `getDropState`, …):
  an adapter never re-implements them.

**In Vue** (`packages/vue`, tests in `packages/vue/tests`, the same contract): `as` (a tag or a
component) and a `render` scoped slot (`{ props, state, children }`) replace `render`; scoped slots
replace children functions (`#splitter="{ props }"` replaces `renderSplitter`); `class`/`style` are
fallthrough attributes merged under the structural style (no function form: `data-*` or the
slot's `state`); listener names are Vue's (`onPointerdown`, `onKeydown`); composables return
`{ state, props }` as computed refs; `typedDockable<Types>()` types the parts a template cannot
give a type argument; content is teleported into the moveable element; a new `model` remounts
the root (a new engine, as React's new engine does). Every part reads the engine's revision in its
render, and the measure cycle runs once per flush, after every part rendered (`nextTick`).

**In Angular** (`packages/angular`, tests in `packages/angular/tests`, the same contract): each
primitive is a standalone attribute directive on the consumer's element (`[dockableTabSet]="node"`;
the element replaces `render`), with signal inputs, outputs for the callbacks (`(popoutOpen)`,
`(transfer)`, `(dropped)`), `host` bindings for the ARIA, the `data-*` and the listeners, and the
structural style applied by an effect (it wins over a static `style`; the consumer's `class` and
other keys are untouched); each part's `state()` is a signal through `exportAs`. Template
directives replace children functions (`<ng-template dockableRowChild let-node>`,
`dockableTabListItem`, `dockablePanels`, `dockablePopout`, `dockableBordersBar`,
`dockableBordersContent`; `dockableRowSplitter`/`dockableBorderSplitter` replace
`renderSplitter`), typed by the model given to them (`[dockablePanels]="model"`,
`ngTemplateContextGuard`); a nested row with no template renders with its parent's. Injection
functions replace hooks (`injectDockable()` gives signals; a part's, `injectTabSet()`, …, reads
the enclosing directive's `state`). The root provides the context (the `DOCKABLE` and
`DOCKABLE_LAYOUT` tokens); the revision is a signal fed by `engine.adapter.subscribe`, and the
measure cycle runs in an `afterRenderEffect`. A panel's content is moved into the tab's moveable
element and its view is never re-created on a move (in a drag group the receiving
`[dockablePanels]` adopts the view); views a part places itself live in no `ViewContainerRef` of
its element (`DetachedViews`), since a container's anchor and views join the root nodes of the
view the element is in. Nothing relies on zone.js.

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
