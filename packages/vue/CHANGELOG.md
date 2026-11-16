# @fragiola/dockable-vue

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
