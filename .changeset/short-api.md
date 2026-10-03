---
"@fragiola/dockable": minor
"@fragiola/dockable-react": minor
---

**Breaking:** the capability flags have short names. They change everywhere: on the nodes, in `defaults`, in the layout JSON and its schema, in command payloads and in the `*-settings-by` results.

| node | before | after |
|---|---|---|
| tab | `enableClose`, `enableDrag`, `enablePopout` | `closable`, `draggable`, `poppable` |
| tabset | `enableClose`, `enableDrag`, `enableDrop`, `enableDivide`, `enableMaximize` | `closable`, `draggable`, `droppable`, `splittable`, `maximizable` |
| border | `enableDrop` | `droppable` |

The React `Tab` state `popoutEnabled` is now `poppable`, and `data-popout-enabled` is now `data-poppable`. JSON stays `version: 1`. A layout that still uses an old name fails validation.
