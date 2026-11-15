---
"@fragiola/dockable-angular": patch
---

A class or style binding on a tab's, a tabset's or a splitter's own element can read its `state()`
(and the splitter's `aria()`): `<div [dockableTab]="tab" #part="dockableTab" [class.italic]="part.state().pinned">`
threw NG0950 on the first render, because Angular applies an element's class bindings before it sets
its directives' inputs. Until the input is set, the part answers a neutral state, then its own.
