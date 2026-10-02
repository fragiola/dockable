---
"@fragiola/dockable": minor
"@fragiola/dockable-react": minor
---

The first release of Dockable, a headless layout manager for dockable panels.

- `@fragiola/dockable`, the framework-free core: a typed model of the layout (JSON v1 with its JSON Schemas) changed only through named commands and your middleware, the layout engine (measuring, positioning, splitter math), drag and drop, popout windows and keyboard navigation. Zero runtime dependencies; the model loads in plain Node.
- `@fragiola/dockable-react`, the React 19 primitives (`Dockable.Root`, `Row`, `TabSet`, `TabList`, `Tab`, `Panel`, `Splitter`, borders, popouts, …) and their hooks. It re-exports the whole core, so a React app installs this one package.
- Headless: no CSS, no icons, no rendered menus and no text. State is exposed through `data-*` and ARIA, and every visible word and accessible name comes from the app.
- Logical sides (`start`/`end`) and right-to-left layouts that can be resized and rearranged.

Dockable is `0.x`: until `1.0`, the API may break between minor versions, and this changelog says what changed and how to update. See the [stability note](https://fragiola.com/dockable/docs/getting-started/installation).
