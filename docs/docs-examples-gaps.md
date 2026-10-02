# Docs examples report

> **Pre-v2.** This report describes the API before Engine v2 (Epic #43): `Actions`,
> `doAction`, `onAction`, node getters and `IJsonModel` are gone. See the design record,
> [docs/engine-v2-design.md](engine-v2-design.md), for what replaced them.

Epic #10 built the documentation site (the first docs site, since replaced by fragiola.com/dockable) and 26 examples against the packages as
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
| E4 | `focused-tab`, every example's active marker | The selected tab of the **active** tabset (gap 1). | `in-data-active:` on the tab (`[data-active] [data-selected]` in CSS). | `data-tabset-active` on `Tab`. |
| E5 | `tabs-at-bottom`, `scoped-palettes`, every example's `Dockable.Panel` | A panel following its tabset: radius, palette (gap 2). | The panel repeats the tabset's radius (swapped to the top when the strip is at the bottom); the content repeats the tabset's palette from its `config`. | `data-tabset` and the tabset node in `PanelState`. |
| E6 | `popout`, `analytics-dashboard` | Pop out and dock back buttons (gap 7). | The header reads `isEnablePopout()`/`isSupportsPopout()`; dock back is `Actions.moveNode` into the main active tabset. | **Done in #20**: `Dockable.PopoutTrigger` (`target="tab" \| "tabset"`, `data-mode` popout/dock), and `engine.popout`/`dockBack`/`canPopout`/`isInWindow`. The examples' workaround is gone. |
| E7 | `popout`, `popout-drag`, `multi-monitor` | Popouts on the example's theme (gap 3). | None left: the hosts put `data-example-theme` on `<body>`. | **Done in #20**: `popoutMirrorRoot` on `Root` (`mirrorRoot` on `PopoutManager`) mirrors `<html>`/`<body>` attributes, the example theme included. |
| E8 | `close-tabs`, `drag-and-drop`, docs | Spread a `render` function's props onto a `<div>`/`<button>`. `RenderedProps.ref` is `Ref<HTMLElement>`, not assignable to `Ref<HTMLDivElement>`. | A cast (`props.ref as Ref<HTMLDivElement>`). The API docs note it. | Make `RenderedProps` generic over the element, or type the merged ref as `RefCallback<HTMLElement>`. |
| E9 | `rename-tabs` | A text field inside a tab. The tab handles Enter, Space, arrows, Home, End, `Ctrl+Delete` (and prevents their default) and drags. | The field stops key propagation; the tab gets `draggable={false}` while editing. | `Tab` ignores keys and drags whose target is editable, or a `Dockable.TabRename` part. |
| E10 | `overflow-select`, `ide-workbench` | Know when a tab list overflows. | A `ResizeObserver` plus `scrollWidth > clientWidth` in the consumer; the list stays mounted (`invisible`) so the engine keeps measuring the strip. | **Done in #32**: tab overflow in the engine (`computeTabOverflow`, `registerTabList`), `data-overflowing` on `TabList`, `data-overflow-hidden` on `Tab`, `useTabOverflow` and `Dockable.TabOverflowTrigger`. Only the tabs that do not fit leave the strip, the selected one stays. Both examples' workarounds are gone. |
| E11 | `maximize` | Escape restores a maximized tabset. | A `keydown` listener on `engine.getCurrentDocument()`. | A `restoreMaximized` key in the keymap. |
| E12 | `ide-workbench` | Ask before closing a modified tab, however it closes (button, menu, `Ctrl+Delete`). | `onAction` vetoes `DELETE_TAB`, and the dialog re-dispatches it with the id in a "confirmed" set. | `onBeforeCloseTab(tab) => boolean \| Promise<boolean>`, or a documented veto-and-re-dispatch recipe. |
| E13 | `content-aware-tabs`, `ide-workbench`, `analytics-dashboard`, `ops-monitor` | Content reports a state (status, dirty) that the tab shows. | `Actions.updateNodeAttributes(tab, { config })` (the whole config, spread) + `getConfig()` + a consumer `data-*` on `Tab`. | Transient, non-serialized per-tab state, or a shallow merge of `config`. |
| E14 | `analytics-dashboard`, `undo-redo` | Status writes must not create undo steps; named steps; disposal. | `ignoreActionTypes: [UPDATE_NODE_ATTRIBUTES]` (which also ignores real edits); labels mirrored in `onModelChange`; the manager is not disposed (StrictMode would dispose the reused instance). | `ignore(action) => boolean`, `getHistory()`, and a `useUndoManager(model)` hook. |
| E15 | `ide-workbench` | An empty state inside an empty tabset. `TabSetContent` takes no children. | `render={<div>{placeholder}</div>}` on `TabSetContent`. | Document it, or accept `children`. |
| E16 | `close-tabs` | Middle-click to close. | `onAuxClick` dispatching `Actions.deleteTab`. | Optional `closeOnMiddleClick` (FlexLayout has it), or a documented recipe. |
| E17 | `event-toasts` (Epic #86) | Read a committed command's payload and result by command, typed. `CommandEvent.payload` and `result` are `unknown` (one listener sees every command). | A small `field(value, key)` reader (`Reflect.get` after an object check) and a type check on each field it reads; no cast. | A `CommandEvent<T>` union discriminated by `command`, as `CommandContext<T>` already is for middleware. |
| E18 | `splitter-wide`, `splitter-dotted-handle`, `splitter-framed-handle` (Epic #86) | `aria-valuenow` after one arrow key on a splitter. The first press moves the splitter but the separator's value updates only with the next one. | The specs press the arrow key twice. | The splitter re-reads its value after a keyboard step commits. |
| E19 | `drop-indicator-colours` (Epic #86) | Style the drop indicator by the tabset it targets. The core's indicator state has `targetTabSetId`, but `Dockable.DropIndicator`'s state (what `className`/`style` receive) does not. | Each tabset reads its own `useTabSet(node).state.dropTarget` and reports its id to the example's state in an effect; the indicator's class reads it. | **Done in #106**: `targetTabsetId` and `targetNodeId` in `DropIndicatorState`. The example's workaround is gone (#109). |
| E20 | `rename-tabs` (Epic #86) | Change one field every component's data shares (`name`) with `tab.update`. With more than one component in the registry, `{ component: tab.component, data: { ...tab.data, name } }` does not compile: the union of components does not narrow the union of data. | A `renamed(tab, name)` helper that switches on `tab.component` and builds each payload. | A typed helper (`tabUpdate(tab, (data) => …)`) or a `tab.rename` command for the shared name. |
| E21 | `active-tab-controls`, `external-tab-switcher`, `remote-control`, `overlay-borders`, `component-factory`, `layout-lab` (Epic #100) | Follow the layout from UI outside `Dockable.Root`. `useModelState` reads the root's model from context only. | `useSyncExternalStore(model.subscribe, () => model.state)` by hand; two examples re-render the whole layout on every commit. | **Done in #106**: `useModelState(selector, { model })` works anywhere and re-renders only when its answer changes (`isEqual` moves into the same options). |
| E22 | `multi-monitor`, `overlay-borders` (Epic #100) | List the popout windows and the borders. | `model.state.windows` and `model.state.borders`, read directly. | **Done in #106**: `model.get("windows")` and `model.get("borders")` (no `layoutId`: windows are the model's, borders the main layout's). |
| E23 | `active-tab-controls`, `add-tabs`, `analytics-dashboard`, `drop-files`, `event-toasts`, `external-tab-switcher`, `layout-lab`, `remote-control`, `widget-sidebar` (Epic #100) | The tabset to add into when the user named none. | `model.get("active-tabset") ?? model.get("tabsets")[0]`. | **Done in #106**: `model.get("default-tabset", { layoutId? })`, the layout's active tabset, else its first; `window.close` and `dock-back` use the same rule. `to: <layoutId>` keeps its meaning (the layout's root row). |
| E24 | the React package (Angular and Vue adapters next) (Epic #100) | The layout rules an adapter applies: which borders show (and the drag reveal), where an overlay border sits, the tab stop with no selected tab, the flex sizing of rows and tabsets. | Each rule written in a React part (`Borders`, `BorderContent`, `Tab`, `Row`, `TabSet`, `PopoutTrigger`), so every adapter would copy it. | **Done in #106 and #107**: `engine.is("border-shown", { borderId })`, `engine.get("overlay-placement-by", { borderId })`, `engine.is("tab-tabbable", { tabId })` and `engine.get("flex-by", { nodeId })` (which replaces `size-limits-by`). #107 adds `engine.get("popout-mode-by", { nodeId })`, the popout trigger's mode (`"dock"` in a window, `"popout"` when `engine.can("popout")`, else none). |

## 2. Site and Fragiola UI (not package gaps)

- **Popups and popouts take the example theme from the document.** The embed and the playground
  put `data-example-theme` on `<body>` (`examples/react/vite.shared.ts`, `src/embed/messages.ts`,
  `apps/playground/src/view.ts`), so Fragiola menus, selects, tooltips and dialogs portalled into
  `document.body`, and popout windows (`popoutMirrorRoot` copies `<body>`'s attributes), are themed
  with no code in the examples. The playground's shell keeps its own palette (`palette-shell`).
  Fragiola UI: a `container` prop on the `*.Content` parts would still let a menu opened in a
  popout window render there (today it opens in the main document).
- **Themes set values only.** A theme file declares the palettes and the `--dk-*` tokens; it styles
  no markup (`tests/themes.test.ts`), so everything an example looks like is in its own code.
  Looks that are not a value (terminal's bracketed labels, paper's floating pills, ide's marker on
  top) were dropped; the selected tab, the strip, the line between tabs, the active marker, the
  active tabset's border and the panel texture are tokens.
- **A chart is keyed on the page's theme.** A panel's content is portalled into the tab's
  moveable element, which the engine attaches after the first commit, and a Fragiola chart reads
  its colours from its own element only when it mounts. `useChartKey` (`_kit/charts.tsx`) mounts
  the chart once its element is in the document and remounts it a frame after any `<html>`/`<body>`
  attribute changes, so a chart moved into a popout reads the colours its window mirrored.
- **The examples manifest** follows imports with a line-anchored regex, so import lines inside
  strings are ignored. A TypeScript parser would be exact, but TypeScript 7 has no JS API.
- **`fumadocs-typescript`** cannot run (same reason): the API prop tables are written by hand and
  `tests/docs-reference.test.ts` fails when a public prop, action, attribute or label has no row.

## 3. Fixed in the examples during the Epic

- Charts drew blank: a panel's content is attached to the layout after the first commit, so
  `useChartKey` (`_kit/charts.tsx`) mounts the chart once its element is in the document.
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
