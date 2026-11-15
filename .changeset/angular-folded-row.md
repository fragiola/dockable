---
"@fragiola/dockable-angular": patch
---

A nested row that renders with its parent row's templates folds away without an error: when its
last tabset but one emptied (its last tab dropped on an edge of the layout, say), a tab list of the
tabset that moved up was read once more after its old tabset had gone, and threw "must be used
inside [dockableTabSet] or [dockableBorder]". It keeps the tabset it last had until its view goes.
