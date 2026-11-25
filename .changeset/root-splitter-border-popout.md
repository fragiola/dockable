---
"@fragiola/dockable-react": minor
"@fragiola/dockable-vue": minor
"@fragiola/dockable-angular": minor
---

One splitter renderer for every row, and a pop out button in a border.

- `renderSplitter` on `Dockable.Root` (Vue: the root's `#splitter` slot; Angular: an
  `<ng-template dockableRowSplitter>` directly in `[dockableRoot]`) renders the splitters of every
  row of the model's layouts: the root row, nested rows and the rows of `Dockable.Popout`. A row's
  own `renderSplitter` still wins, and `splitter={false}` still renders none.
- `Dockable.PopoutTrigger` (`[dockablePopoutTrigger]`) works inside `Dockable.Border` too: it pops
  the border's selected tab out. `target="tabset"` renders nothing there (hidden in Angular).
