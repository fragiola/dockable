---
"@fragiola/dockable-vue": patch
---

A tab moved to another tabset stays measured: Vue can attach the tab's new element before it detaches the old one, and the old element's removal no longer unregisters the new one. Tab overflow now counts a tab dropped into a strip (the same guard covers tabsets, rows, tab strips, tab lists and overflow triggers).
