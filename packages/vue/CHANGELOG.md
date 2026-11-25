# @fragiola/dockable-vue

## 0.4.0

### Minor Changes

- [#176](https://github.com/fragiola/dockable/pull/176) [`53417bd`](https://github.com/fragiola/dockable/commit/53417bdb390173710679ebd394588e6e66aaf0a5) Thanks [@maurodesouza](https://github.com/maurodesouza)! - One splitter renderer for every row, and a pop out button in a border.
  
  - `renderSplitter` on `Dockable.Root` (Vue: the root's `#splitter` slot; Angular: an
    `<ng-template dockableRowSplitter>` directly in `[dockableRoot]`) renders the splitters of every
    row of the model's layouts: the root row, nested rows and the rows of `Dockable.Popout`. A row's
    own `renderSplitter` still wins, and `splitter={false}` still renders none.
  - `Dockable.PopoutTrigger` (`[dockablePopoutTrigger]`) works inside `Dockable.Border` too: it pops
    the border's selected tab out. `target="tabset"` renders nothing there (hidden in Angular).

- [#176](https://github.com/fragiola/dockable/pull/176) [`004b19f`](https://github.com/fragiola/dockable/commit/004b19fc37be3c2c9954dcf3d3870e7a0f3f1f0c) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A tab and its panel follow their tabset, `F2` asks the app to rename a tab, and a tab button can
  host an editor.
  
  - `Tab` and `Panel` carry `data-tabset-active` (and `tabsetActive` in their state) while their
    tabset is its layout's active tabset, answered by the new `model.is("tab-in-active-tabset", { tabId })`.
    "The selected tab of the active tabset" is `[data-tabset-active][data-selected]`, with no ancestor
    selector, and a panel can be styled by its tabset's state.
  - The key map's `renameTab` key (`F2`) acts: on a tab button it calls the tab's rename handler
    (React `onRenameRequest`, Vue `@rename-request`, Angular `(renameRequest)`) when the model allows
    renaming the tab (tabset tabs only), and `aria-keyshortcuts` names the key only then. The rename UI
    stays the app's.
  - An editor inside a tab button (an `input`, a `textarea`, a `select`, `contenteditable`) keeps its
    keys and its pointer: they are not tab keys there, and a press in it selects text instead of
    dragging the tab. `engine.adapter.handleTabKeyDown` takes `onRenameRequest`, and
    `engine.adapter.getKeyShortcuts("tab", tabId, { rename })` the handler's presence.

### Patch Changes

- Updated dependencies [[`004b19f`](https://github.com/fragiola/dockable/commit/004b19fc37be3c2c9954dcf3d3870e7a0f3f1f0c)]:
  - @fragiola/dockable@0.4.0

## 0.3.0

### Minor Changes

- [#150](https://github.com/fragiola/dockable/pull/150) [`e7c7c33`](https://github.com/fragiola/dockable/commit/e7c7c336c9f58e8667b3d5316f6e42ea04f51a83) Thanks [@maurodesouza](https://github.com/maurodesouza)! - New package: `@fragiola/dockable-angular`, the Dockable primitives for Angular 22. Every primitive of the React package is a standalone attribute directive on an element you write (`[dockableRoot]`, `[dockableRow]`, `[dockableTabSet]`, `[dockableTabList]`, `[dockableTab]`, `[dockablePanel]`, `[dockableSplitter]`, `[dockableBorders]`, `[dockableDragGroup]`, …), with signal inputs, `host` bindings and zoneless change detection; every hook is an injection function (`injectDockable()`, `injectModelState()`, `injectTabSet()`, …); `DOCKABLE` lists every directive for a component's `imports`; and the whole core is re-exported, so an Angular app installs one package. The recursion is template directives (`<ng-template dockableRowChild let-node>`, `dockableTabListItem`, `dockablePanels`, `dockablePopout`, `dockableRowSplitter` instead of `renderSplitter`), whose contexts are typed by the model they are given. A moved tab's content is never re-created, across tabsets, borders, popout windows and the layouts of a drag group. It is built with ng-packagr (Angular Package Format, ESM only) and published from its build output.

- [#147](https://github.com/fragiola/dockable/pull/147) [`eaa69b7`](https://github.com/fragiola/dockable/commit/eaa69b74cc24d86165eff70a32afae9f3453b9c9) Thanks [@maurodesouza](https://github.com/maurodesouza)! - New package: `@fragiola/dockable-vue`, the Dockable primitives for Vue 3.5. Every primitive of the React package is a Vue component under the same `Dockable` namespace, every hook is a composable, and the whole core is re-exported, so a Vue app installs one package. Polymorphism is `as` and a `render` scoped slot, the recursion is scoped slots (`#splitter` replaces `renderSplitter`), `class` and `style` are fallthrough attributes merged under the structural style, and `typedDockable<Types>()` types the parts a template cannot give a type argument.
  
  The core's engine gains adapter keys for the rules every adapter applies to its parts' events, so no adapter re-implements them: `engine.adapter.handleTabKeyDown`, `handleTabClick`, `handleTabSetPointerDown`, `handlePanelPointerDown`, `handlePanelKeyDown`, `handleDocumentKeyDown`, `getKeyShortcuts`, `getKeyMap`, `getDropState` and `isDraggable`, with `keyMap` as an engine setting. The React primitives use them, with no change of behaviour.

### Patch Changes

- [#149](https://github.com/fragiola/dockable/pull/149) [`96fa3d9`](https://github.com/fragiola/dockable/commit/96fa3d991ebe210bc6327b495cf89e41343d276b) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A bare boolean attribute turns a part's prop on, as Vue does for boolean props:
  `<Dockable.Root popout-mirror-root>` (and `supports-popout`, `realtime-resize`, a `TabList`'s
  `overflow`, a `Panel`'s `scrollable`/`remount-in-window`, `Panels`' `render-on-demand`, a `Row`'s
  or `BorderContent`'s `splitter`) was the empty string, so the option stayed off. Absent, they stay
  `undefined` and the core's default applies.

- [#149](https://github.com/fragiola/dockable/pull/149) [`14a7f47`](https://github.com/fragiola/dockable/commit/14a7f47db52a5e857d1669fe863038e58882f77c) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A tab moved to another tabset stays measured: Vue can attach the tab's new element before it detaches the old one, and the old element's removal no longer unregisters the new one. Tab overflow now counts a tab dropped into a strip (the same guard covers tabsets, rows, tab strips, tab lists and overflow triggers).
- Updated dependencies [[`e7c7c33`](https://github.com/fragiola/dockable/commit/e7c7c336c9f58e8667b3d5316f6e42ea04f51a83), [`eaa69b7`](https://github.com/fragiola/dockable/commit/eaa69b74cc24d86165eff70a32afae9f3453b9c9)]:
  - @fragiola/dockable@0.3.0
