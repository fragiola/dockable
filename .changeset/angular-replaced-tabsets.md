---
"@fragiola/dockable-angular": patch
---

A layout whose tabsets a command removes (`layout.load`, for example) renders the new ones: the tab list and tabs of a removed tabset no longer throw "must be used inside [dockableTabSet]" while Angular destroys them.
