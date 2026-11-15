---
"@fragiola/dockable-vue": patch
---

A bare boolean attribute turns a part's prop on, as Vue does for boolean props:
`<Dockable.Root popout-mirror-root>` (and `supports-popout`, `realtime-resize`, a `TabList`'s
`overflow`, a `Panel`'s `scrollable`/`remount-in-window`, `Panels`' `render-on-demand`, a `Row`'s
or `BorderContent`'s `splitter`) was the empty string, so the option stayed off. Absent, they stay
`undefined` and the core's default applies.
