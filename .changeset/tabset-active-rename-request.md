---
"@fragiola/dockable": minor
"@fragiola/dockable-react": minor
"@fragiola/dockable-vue": minor
"@fragiola/dockable-angular": minor
---

A tab and its panel follow their tabset, `F2` asks the app to rename a tab, and a tab button can
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
