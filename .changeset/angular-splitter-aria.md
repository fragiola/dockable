---
"@fragiola/dockable-angular": patch
---

A splitter's ARIA values are readable from its template: `[dockableSplitter]`'s `aria()` (through
`#s="dockableSplitter"`) gives the `orientation`, `valueNow`, `valueMin`, `valueMax` and `valueText`
its `aria-*` attributes carry, so a readout can show where the splitter sits, as React's `render`
and Vue's `#render` hand the separator's props over. It was protected, so a template could not.
