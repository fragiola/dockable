# @fragiola/dockable-react

## 0.2.0

### Minor Changes

- [#129](https://github.com/fragiola/dockable/pull/129) [`f11ca8e`](https://github.com/fragiola/dockable/commit/f11ca8e07c43dccc6b26a6747ebd45e8217cf38b) Thanks [@maurodesouza](https://github.com/maurodesouza)! - **Breaking:** the capability flags have short names. They change everywhere: on the nodes, in `defaults`, in the layout JSON and its schema, in command payloads and in the `*-settings-by` results.
  
  | node | before | after |
  |---|---|---|
  | tab | `enableClose`, `enableDrag`, `enablePopout` | `closable`, `draggable`, `poppable` |
  | tabset | `enableClose`, `enableDrag`, `enableDrop`, `enableDivide`, `enableMaximize` | `closable`, `draggable`, `droppable`, `splittable`, `maximizable` |
  | border | `enableDrop` | `droppable` |
  
  The React `Tab` state `popoutEnabled` is now `poppable`, and `data-popout-enabled` is now `data-poppable`. JSON stays `version: 1`. A layout that still uses an old name fails validation.
  
  **Breaking:** renaming is a tab capability. A tab has a `renamable` field (default `true`, also settable in `defaults.tab`). The new command `tab.rename { tabId, label }` changes a tab's label, and it is refused for a tab that is not renamable. `tab.configure` no longer takes `label`, and `model.can("tab.rename", { tabId, label })` answers a menu or an F2 handler.

### Patch Changes

- Updated dependencies [[`f11ca8e`](https://github.com/fragiola/dockable/commit/f11ca8e07c43dccc6b26a6747ebd45e8217cf38b)]:
  - @fragiola/dockable@0.2.0

## 0.1.0

### Minor Changes

- [#123](https://github.com/fragiola/dockable/pull/123) [`044d0fb`](https://github.com/fragiola/dockable/commit/044d0fb8deec70debbf07c23d5e603b61b398fc3) Thanks [@maurodesouza](https://github.com/maurodesouza)! - The first release of Dockable, a headless layout manager for dockable panels.
  
  - `@fragiola/dockable`, the framework-free core: a typed model of the layout (JSON v1 with its JSON Schemas) changed only through named commands and your middleware, the layout engine (measuring, positioning, splitter math), drag and drop, popout windows and keyboard navigation. Zero runtime dependencies; the model loads in plain Node.
  - `@fragiola/dockable-react`, the React 19 primitives (`Dockable.Root`, `Row`, `TabSet`, `TabList`, `Tab`, `Panel`, `Splitter`, borders, popouts, …) and their hooks. It re-exports the whole core, so a React app installs this one package.
  - Headless: no CSS, no icons, no rendered menus and no text. State is exposed through `data-*` and ARIA, and every visible word and accessible name comes from the app.
  - Logical sides (`start`/`end`) and right-to-left layouts that can be resized and rearranged.
  
  Dockable is `0.x`: until `1.0`, the API may break between minor versions, and this changelog says what changed and how to update. See the [stability note](https://fragiola.com/dockable/docs/getting-started/installation).

### Patch Changes

- Updated dependencies [[`044d0fb`](https://github.com/fragiola/dockable/commit/044d0fb8deec70debbf07c23d5e603b61b398fc3)]:
  - @fragiola/dockable@0.1.0
