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

**Breaking:** renaming is a tab capability. A tab has a `renamable` field (default `true`, also settable in `defaults.tab`). The new command `tab.rename { tabId, label }` changes a tab's label, and it is refused for a tab that is not renamable. `tab.configure` no longer takes `label`, and `model.can("tab.rename", { tabId, label })` answers a menu or an F2 handler.
