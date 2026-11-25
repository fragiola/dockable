# @fragiola/dockable-angular

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

### Patch Changes

- [#151](https://github.com/fragiola/dockable/pull/151) [`d948c52`](https://github.com/fragiola/dockable/commit/d948c5250470014be2befac0d5bb8d45474ecc5e) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A nested row that renders with its parent row's templates folds away without an error: when its
  last tabset but one emptied (its last tab dropped on an edge of the layout, say), a tab list of the
  tabset that moved up was read once more after its old tabset had gone, and threw "must be used
  inside [dockableTabSet] or [dockableBorder]". It keeps the tabset it last had until its view goes.

- [#151](https://github.com/fragiola/dockable/pull/151) [`463576f`](https://github.com/fragiola/dockable/commit/463576ffee6b6413916d697a099f46cbdb66a2f1) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A splitter resized from the keyboard renders its new size and `aria-valuenow` before the key's handlers return, as the React and Vue adapters do, instead of on Angular's next frame.

- [#151](https://github.com/fragiola/dockable/pull/151) [`1118e89`](https://github.com/fragiola/dockable/commit/1118e89d442af2fab7f40119736129d55e87084a) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A tab list, a tabset's content area and a tab overflow trigger update their `data-layout-path` when a tabset is inserted before theirs (a drop at the layout's edge).

- [#151](https://github.com/fragiola/dockable/pull/151) [`a132a87`](https://github.com/fragiola/dockable/commit/a132a8738c116c4b9b343a6131036e8740b5449e) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A layout whose tabsets a command removes (`layout.load`, for example) renders the new ones: the tab list and tabs of a removed tabset no longer throw "must be used inside [dockableTabSet]" while Angular destroys them.

- [#151](https://github.com/fragiola/dockable/pull/151) [`f444c8e`](https://github.com/fragiola/dockable/commit/f444c8eb76464394dec6e5ca6377ade5760c9140) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A splitter's ARIA values are readable from its template: `[dockableSplitter]`'s `aria()` (through
  `#s="dockableSplitter"`) gives the `orientation`, `valueNow`, `valueMin`, `valueMax` and `valueText`
  its `aria-*` attributes carry, so a readout can show where the splitter sits, as React's `render`
  and Vue's `#render` hand the separator's props over. It was protected, so a template could not.

- [#151](https://github.com/fragiola/dockable/pull/151) [`52f81de`](https://github.com/fragiola/dockable/commit/52f81de9910c39819fc41c7f2bf504db1b186151) Thanks [@maurodesouza](https://github.com/maurodesouza)! - A class or style binding on a tab's, a tabset's or a splitter's own element can read its `state()`
  (and the splitter's `aria()`): `<div [dockableTab]="tab" #part="dockableTab" [class.italic]="part.state().pinned">`
  threw NG0950 on the first render, because Angular applies an element's class bindings before it sets
  its directives' inputs. Until the input is set, the part answers a neutral state, then its own.
- Updated dependencies [[`e7c7c33`](https://github.com/fragiola/dockable/commit/e7c7c336c9f58e8667b3d5316f6e42ea04f51a83), [`eaa69b7`](https://github.com/fragiola/dockable/commit/eaa69b74cc24d86165eff70a32afae9f3453b9c9)]:
  - @fragiola/dockable@0.3.0
