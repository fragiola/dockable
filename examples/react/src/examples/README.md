# Examples

Each folder is one example of the site's gallery (`fragiola.com/dockable/examples/<folder>`),
rendered alone by this app at `index.html?id=<folder>`.

```
src/examples/
  <slug>/index.tsx     the example (default export, "use client")
  <slug>/styles.ts     how it looks: one class string (or state function) per part
  <slug>/*.ts(x)       optional sibling files, shown in the code panel
  _kit/                shared demo content and app logic (cards, charts, tables, the rename
                       field, the undo manager, the seeded trading feed); no Dockable assembly,
                       no styles
```

What every framework's examples share, and no reader copies, lives once in
`examples/shared` (`examples-shared`, private), so a Vue or Angular app of the same examples
reuses it:

```
examples/shared/
  src/meta/<slug>.ts   each example's metadata: title, description, category, order, features,
                       docs link, layout, height (one file per example, for every framework)
  src/meta-types.ts    its shape, the categories and the default heights
  src/themes/          the five themes (one CSS file each, values only) and their list
  src/embed/messages.ts  the embed's messages to the site (`fragiola:example:*`)
  scripts/             the examples finder, the manifest builder, the loader generator
  e2e/                 every Playwright spec (smoke, themes, iframe, examples/<slug>.spec.ts),
                       run against each framework's embed (`examplesE2eConfig`)
  tests/               the metadata, themes, contrast and e2e-helper checks
```

An example of this app is a folder `src/examples/<slug>/` with an `index.tsx`, and its metadata is
found by its slug. A folder without metadata, or metadata that no framework app has a folder for,
fails `examples/shared/tests/meta.test.ts`.

## Categories

The gallery groups examples by the feature they show (`CATEGORIES` in
`examples/shared/src/meta-types.ts`, in sidebar
order; the site export contract calls a category a `level`). An example belongs where a reader
looking for its feature would search, and `order` is its place inside the category.

| category | what belongs in it |
|---|---|
| `getting-started` | the first layouts: the smallest themed one, the unstyled one |
| `tabs` | what a tab and a tabset do: close, rename, pin, menus, overflow, focus, keyboard, maximize |
| `splitters` | one splitter customisation per example: size, line, handle |
| `drag-and-drop` | the drag inside the layout: indicators, highlights, drop zones, refused drops |
| `borders` | side bars with tabs: split, overlay, orientation |
| `popouts` | windows: pop out, drag between windows, several monitors |
| `styling` | theming that is not about one part |
| `model-api` | the model from code: commands, `can`/`check`, middleware, events, history, persistence |
| `external-integration` | app UI outside the layout driving it: toolbars, sidebars, files from the desktop |
| `apps` | whole applications that combine many features |

## Adding an example

An example exists in every framework, with the same id: React (`examples/react`), Vue
(`examples/vue`) and Angular (`examples/angular`) ship every one, and their tests fail when a slug
is in one app and not another (`examples/{vue,angular}/tests/examples.test.ts`); the shared e2e
specs fail, not skip, for an example one lacks (`COMPLETE_FRAMEWORKS` in
`examples/shared/e2e/available.ts`).

1. Create `src/examples/<slug>/index.tsx`, and its metadata in
   `examples/shared/src/meta/<slug>.ts` (see `meta-types.ts`) unless another framework already
   has the example.
2. `pnpm dev` at the root lists it in the playground (`apps/playground`), with hot reload, the five
   themes and its source: `http://localhost:5173/?example=<slug>`. The embed alone is
   `pnpm --filter examples-react dev` (`http://localhost:5180/?id=<slug>`, it regenerates the
   loaders); `pnpm site:dev --base /dockable` serves it the way the site proxies it.
3. The smoke e2e visits it in the reference theme (every theme only for the representative
   examples in `examples/shared/e2e/smoke.spec.ts`; `E2E_ALL_THEMES=1` runs them all), and inside
   an iframe. Add a spec for its main behaviour in `examples/shared/e2e/examples/<slug>.spec.ts`:
   it reaches the example only through `data-layout-path`, roles, accessible names and test ids,
   so every framework's embed runs it unchanged.
4. Write its Vue twin in `examples/vue/src/examples/<slug>/`: `index.vue` (the entry, which
   renders `<Dockable.Root>`), `styles.ts` (the React one, importing `@fragiola/dockable-vue`),
   `dockable.ts` (the `Types` registry and `typedDockable<Types>()`, since a template cannot pass
   a type argument) and one single-file component per part React writes as a function
   (`layout-node.vue` for the recursion, `splitter.vue`, …). The same layout JSON, `Types`, logic
   order, roles, names and test ids; the Vue API differs where the adapter's does (`as` and the
   `render` slot, scoped slots for children functions, no `class` function: `data-*` variants or
   the slot's `state`). Its kit is `examples/vue/src/components` (Fragiola UI's pieces over Reka
   UI, with the React kit's classes) and `examples/vue/src/examples/_kit`. Check it with
   `pnpm --filter examples-vue dev` (`http://localhost:5181/?id=<slug>`) and its spec against the
   Vue embed (`pnpm --filter examples-vue e2e`).
5. Write its Angular twin in `examples/angular/src/examples/<slug>/`: `index.ts` (the entry, a
   standalone component with an inline template, `export default class`, `host: { class:
   "contents" }`, which puts `[dockableRoot]` on an element), `styles.ts` (the React one,
   importing `@fragiola/dockable-angular`; bound with `[class]`, never a `class="…"` in the
   example's files) and one standalone component per part React writes as a function, in its own
   `.ts`. The same layout JSON, `Types`, logic order, roles, names and test ids; the Angular API
   differs where the adapter's does (attribute directives on your own elements, `ng-template`
   directives for children functions, each part's `state()` through `exportAs`, injection
   functions; UI outside the parts reads the model through `injectModelState`). Its kit is
   `examples/angular/src/components` (Fragiola UI's pieces over Angular CDK, with the React kit's
   classes: a trigger directive given the popup's `ng-template`, whose root element is the
   content) and `examples/angular/src/examples/_kit`. Check it with
   `pnpm --filter examples-angular dev` (`http://localhost:5182/?id=<slug>`) and its spec against
   the Angular embed (`pnpm --filter examples-angular e2e`).

## Anatomy of an example

A reader opens `index.tsx` and sees the logic first: what is rendered, how Dockable is assembled,
which API is called. How it looks is one click away, in `styles.ts`. The code panel shows the
example's files, the shared demo content it imports and the theme's CSS, and nothing else.

```tsx
import * as styles from "./styles";

export default function HelloLayout() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className={styles.frame}>
            <Dockable.Root model={model} className={styles.root}>
                <Dockable.Row<Types> renderSplitter={(props) => <Splitter {...props} />}>
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Card name={tab.label} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
            </Dockable.Root>
        </div>
    );
}
```

```ts
// styles.ts
export const panel = "palette-raised overflow-auto rounded-b-[…] bg-palette-base …";
export const dropIndicator = (state: DropIndicatorState) =>
    cn("z-20 rounded-(--dk-radius) border-2 …", state.kind === "edge" ? "palette-orange …" : "palette-blue …");
```

`hello-layout` is the reference: the recursion (`renderNode`), the `TabSet` and the `Splitter` are
functions in the same file, below the default export. Its comments explain the parts every example
shares (the sized wrapper, the recursion, the splitter, the active marker, the drop indicator);
the other examples comment only what they do differently.

- **`index.tsx` renders `<Dockable.Root>`** and the tree under it. Parts may be components in the
  same file or in sibling files of the same folder (`tabs.tsx`, `panels.tsx`), never in a shared
  module: `_kit/` holds no Dockable assembly (`tests/examples.test.ts`).
- **Only the parts the example uses.** `Dockable.Borders` only when the model has borders,
  `Dockable.Popout` (and `popoutURL`, `popoutMirrorRoot` on the root) only when it pops out,
  `Dockable.EdgeIndicator` only when it shows edge targets.
- **No option bags.** A part takes what it renders (`node`, a callback that is the subject of the
  example), not `options` or `renderX` hooks that hide what it renders.
- **Classes in `styles.ts`**, beside `index.tsx`. It exports one `const` per styled part, named
  after the part (`root`, `tabset`, `tabList`, `tab`, `panel`, `splitter`,
  `dropIndicator`, …): a class string, built with `cn()` when it is long or has conditions, or a
  function of the part's state when the classes depend on it (`(state: DropIndicatorState) =>
  cn(…)`, or a plain argument such as a tone). The `.tsx` files `import * as styles from
  "./styles"` and write `className={styles.tab}`; a state function goes straight to the part
  (`className={styles.dropIndicator}`). No `.tsx` file of an example holds a class string or calls
  `cn()` (`tests/examples.test.ts`). An example with several `.tsx` files shares its `styles.ts`.
- **Classes are complete literals.** Tailwind finds a class by reading the source, so
  `` `palette-${tone}` `` is never generated: map a value to a full class instead
  (`{ ok: "palette-green", … }[tone]`).
- **A class that does a job beyond looks keeps a short comment** in `styles.ts`: the panel's bottom radius
  (panels sit above the tabsets, which cannot clip them), the drop indicator's `z-20` (panels are
  portalled after it), the splitter's `::after` grab area, the active marker drawn as the tab's `::after` (`in-data-active:`).
  What is not a class stays in the `.tsx`: `aria-*`, `data-*`, structural `style` props (the
  indicator's `transitionDuration` in `drag-and-drop`, which reads the layout's drag speed), what
  renders when. Elsewhere the indicator moves at the theme's pace (`duration-(--dk-motion)`).
- **Content that fits the story.** Tabs show the kit's charts (`ChartPanel`: line, bar, area,
  pie, donut), KPIs (`KpiPanel`), tables and logs, typed in the registry (`chart: { kind }`; the
  name is the tab's `label`).
  The counter card (`Card`) is for the few examples whose point is content that survives a move
  (`tests/examples.test.ts` lists them).
- **Accessible names inline**: `aria-label="Resize"` on each splitter (through `renderSplitter`),
  on each icon button, on each tab list.
- **Tokens, not values that differ per theme**: radius, sizes, fonts, the selected tab and the
  strip read the `--dk-*` tokens each theme declares (listed in
  `examples/shared/src/themes/<name>.css`).

## Rules (the docs Epic, DD6–DD12)

- **Copyable imports only**: `react`, `@fragiola/dockable-react` (the core included: an app
  installs that one package and never imports `@fragiola/dockable`), `lucide-react`, Fragiola UI
  (`#/components/ui/*`, `#/components/atoms/*`, `#/lib/cn`, `#/hooks/*`), and relative files
  inside `src/examples/`. `#/` is the app's `src/`; `@name` is reserved for packages (site export
  contract, §6). `tests/examples.test.ts` enforces it.
- **Theme-agnostic**: style through palette roles (`bg-palette-base`, …) and the theme tokens
  (`--dk-*`), never fixed colours, so the example works in all five themes.
- **Through the model**: every change is a command (`model.run("tab.close", { tabId })`, with the
  `model` from `useDockable`), which the model's middleware (`model.use`) can veto or rewrite;
  reads go through `model.get`/`model.is`. Screen actions (pop out, dock back) are the engine's
  (`engine.run("popout", { nodeId })`); an example never reaches `engine.adapter`. Nodes are
  immutable data: read them, never mutate them.
- **Typed data**: each example declares its `Types` registry and reads `tab.data` narrowed by
  `tab.component`; no casts on node data or node kinds.
- **State as data**: style the package's state through `data-*` and ARIA only.
- **Accessible names**: every button has `aria-label` or text; the package renders none.
- **Workarounds are commented** in the code (users copy them) and listed in
  `docs/docs-examples-gaps.md` at the repo root.
