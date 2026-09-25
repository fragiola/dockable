# Docs examples report

Epic #10 built the documentation site (`apps/docs`) and 26 examples against the packages as
they are. It changed **no file under `packages/`**. Everything the examples had to work around
is listed here, as input for the next Epics, in the same spirit as
`docs/walking-skeleton-report.md` ("gap N" below refers to its section 2). Each workaround is
also commented in the example's code, since users copy it.

## 1. Package gaps (proposed API)

| # | needed by | needed | workaround | proposed API |
|---|---|---|---|---|
| E1 | `add-tabs`, `ide-workbench`, `analytics-dashboard`, `layout-lab` | Drive the layout from UI **outside** `Dockable.Root` (toolbar, file tree, filters) through the engine, so `onAction` still sees the change. `useDockable()` only works inside the root, and `model.doAction` skips `onAction`. | `_kit/engine-bridge.tsx`: an `EngineBridge` child of the root reports `useDockable().mainEngine` up; the example keeps it in state (it changes with the model). | **Partly done in #18**: `LayoutEngine.of(model)` returns the mounted engine (read it when acting; it changes with the model). An `onEngine` prop would still help UI that must re-render on engine changes. |
| E2 | `locked-regions` | No drop indicator over a target that `setOnAllowDrop` (or `enableDrop`/`enableDivide`) refuses. `DragDropManager.onDragOver` returns early when `findDropTargetNode` finds nothing, so the **last accepted indicator stays visible** and `dropInfo` stays stale (the drop itself does not happen). | The example listens to `dragover` on the document, reads `event.defaultPrevented`, and hides the indicator while the last `dragover` was refused. | **Done in #19**: a refused or empty spot hides the outline; `refused` / `data-drop-refused` on `Root`, `DropIndicator` and the refusing `TabSet`. The example's workaround is gone. |
| E3 | `drag-and-drop` | Highlight the targeted tabset (gap 8). | Reads the indicator state, takes its rect's centre and finds the tabset whose `getRect()` contains it. | **Done in #19**: `data-drop-target` / `data-drop-location` on `TabSet`, `data-drop-target` / `data-drop-index` on `TabList`. The example's workaround is gone. |
| E4 | `focused-tab`, the kit | The selected tab of the **active** tabset (gap 1). | `in-data-active:` on the tab (`[data-active] [data-selected]` in CSS). | `data-tabset-active` on `Tab`. |
| E5 | `tabs-at-bottom`, `scoped-palettes`, the kit | A panel following its tabset: radius, palette (gap 2). | The panel repeats the tabset's radius (swapped to the top when the strip is at the bottom); the content repeats the tabset's palette from its `config`. | `data-tabset` and the tabset node in `PanelState`. |
| E6 | `popout`, `analytics-dashboard` | Pop out and dock back buttons (gap 7). | The header reads `isEnablePopout()`/`isSupportsPopout()`; dock back is `Actions.moveNode` into the main active tabset. | `Dockable.PopoutTrigger`, and a dock-back action for one tab. **#20.** |
| E7 | the kit | Popouts on the example's theme (gap 3). | `usePopoutTheme` copies `data-example-theme` into the popout body on open and on change. | `mirrorRoot` on `PopoutManager`. **#20.** |
| E8 | `close-tabs`, `drag-and-drop`, docs | Spread a `render` function's props onto a `<div>`/`<button>`. `RenderedProps.ref` is `Ref<HTMLElement>`, not assignable to `Ref<HTMLDivElement>`. | A cast (`props.ref as Ref<HTMLDivElement>`). The API docs note it. | Make `RenderedProps` generic over the element, or type the merged ref as `RefCallback<HTMLElement>`. |
| E9 | `rename-tabs`, `tab-context-menu` | A text field inside a tab. The tab handles Enter, Space, arrows, Home, End, `Ctrl+Delete` (and prevents their default) and drags. | The field stops key propagation; the tab gets `draggable={false}` while editing. | `Tab` ignores keys and drags whose target is editable, or a `Dockable.TabRename` part. |
| E10 | `overflow-select`, `ide-workbench` | Know when a tab list overflows. | A `ResizeObserver` plus `scrollWidth > clientWidth` in the consumer; the list stays mounted (`invisible`) so the engine keeps measuring the strip. | `data-overflowing` on `TabList`, from the strip measurements the engine already takes. |
| E11 | `maximize` | Escape restores a maximized tabset. | A `keydown` listener on `engine.getCurrentDocument()`. | A `restoreMaximized` key in the keymap. |
| E12 | `ide-workbench` | Ask before closing a modified tab, however it closes (button, menu, `Ctrl+Delete`). | `onAction` vetoes `DELETE_TAB`, and the dialog re-dispatches it with the id in a "confirmed" set. | `onBeforeCloseTab(tab) => boolean \| Promise<boolean>`, or a documented veto-and-re-dispatch recipe. |
| E13 | `content-aware-tabs`, `ide-workbench`, `analytics-dashboard`, `ops-monitor` | Content reports a state (status, dirty) that the tab shows. | `Actions.updateNodeAttributes(tab, { config })` (the whole config, spread) + `getConfig()` + a consumer `data-*` on `Tab`. | Transient, non-serialized per-tab state, or a shallow merge of `config`. |
| E14 | `analytics-dashboard`, `undo-redo` | Status writes must not create undo steps; named steps; disposal. | `ignoreActionTypes: [UPDATE_NODE_ATTRIBUTES]` (which also ignores real edits); labels mirrored in `onModelChange`; the manager is not disposed (StrictMode would dispose the reused instance). | `ignore(action) => boolean`, `getHistory()`, and a `useUndoManager(model)` hook. |
| E15 | `ide-workbench` | An empty state inside an empty tabset. `TabSetContent` takes no children. | `render={<div>{placeholder}</div>}` on `TabSetContent`. | Document it, or accept `children`. |
| E16 | `close-tabs` | Middle-click to close. | `onAuxClick` dispatching `Actions.deleteTab`. | Optional `closeOnMiddleClick` (FlexLayout has it), or a documented recipe. |

## 2. Site and Fragiola UI (not package gaps)

- **Popups outside the themed stage.** Fragiola menus, selects, tooltips and dialogs portal into
  `document.body`, outside `[data-example-theme]`. `_kit/theme.ts` (`usePopupTheme`,
  `useStageTheme`) puts the attribute on the popup. An app that themes `<html>`/`<body>` does not
  need it. Fragiola UI: a `container` prop on the `*.Content` parts would also let a menu opened
  in a popout window render there (today it opens in the main document).
- **Theme flourishes and custom markup.** The ide/paper/terminal flourishes target the kit's
  `data-kit-*` markers only, so an example's own markup (e.g. `unstyled`) is left alone.
  Themes that restyle the selected tab should not assume the tab's palette is neutral
  (`ops-monitor` colours the status on the icon, a line and the badge instead).
- **The examples manifest** follows imports with a line-anchored regex, so import lines inside
  strings are ignored. A TypeScript parser would be exact, but TypeScript 7 has no JS API.
- **`fumadocs-typescript`** cannot run (same reason): the API prop tables are written by hand and
  `tests/docs-reference.test.ts` fails when a public prop, action, attribute or label has no row.

## 3. Fixed in the kit during the Epic

- Charts drew blank: a panel's content is attached to the layout after the first commit, so
  `useExampleTheme` now retries each frame until the themed ancestor exists.
- The splitter grip read the enclosing `Row`'s `data-orientation` (`in-data-*`); it now reads its
  own (`group-data-*/splitter`).

## 4. Not missing after all

- A tab as a menu trigger: `render={<ContextMenu.Trigger />}` on `Dockable.Tab`.
- Drop rules: `model.setOnAllowDrop` plus `enableDrop`/`enableDrag`/`enableDivide` cover the
  centre, the sides, the strip and the layout edges (only the indicator feedback is missing, E2).
- A component factory from `getComponent()`/`getConfig()`, render on demand, per-tabset palettes
  in the tabset's `config`, and status tabs through `config` + a consumer `data-*`.
- Plain CSS styling: the theme flourishes and the `unstyled` example style the layout from
  `data-*` and ARIA alone.
