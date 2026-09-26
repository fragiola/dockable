# Design note: dragging tabs between independent layouts

Epic #20, work item 2. Two `Dockable.Root`s with **different models** on one page exchange tabs by
drag and drop, and a moved tab keeps its content state.

## Opt-in: a drag group

Layouts accept each other's drags only when they share a `DragGroup` (core). A group is a set of
main engines. `DragDropManager.belongsToDrag` accepts a drag whose main engine is the manager's own
(as before) **or** a member of the same group, when the dragged node is a tab (a tabset, a tab group
or a float's layout never crosses models). Without a shared group the drag is refused, as today.

The target model's rules apply to the foreign tab: hit testing runs in the target model, so its
attributes (`enableDrop`, `enableDivide`) and its `onAllowDrop` decide.

## The transfer

On drop into another model, the target's manager asks the group to transfer the tab:

1. **Both sides are asked first.** `target.interceptAction(Actions.addTab(json, …))`, then
   `source.interceptAction(Actions.deleteTab(id))`. Both go through the layouts' own `onAction`. If
   either vetoes, **nothing changes**. Each action carries `userData.transfer` (the event below), so
   an `onAction` or `onModelChange` can tell a transfer from an ordinary add or delete.
2. **Applied target first.** The add runs in the target model (the tab keeps its id and its JSON);
   if the id is already used there, the transfer is refused before anything runs. Then the delete
   runs in the source model.
3. **The content moves with it.** The new tab adopts the old tab's view state (`adoptViewState`: its
   moveable element, scroll position, rendered flag), so the target panel re-parents the **same**
   element. A framework adapter keeps the content mounted across the two roots (see below).
4. **An event.** The group notifies `onTransfer({ tab, json, from, to })`, where `from` and `to` name
   the model, the layout, the tabset and the index. It is the data an app needs to undo the move.

`group.transfer(tabId, from, to, toNodeId, location, index)` runs the same sequence from code (an
undo, a "send to the other layout" button).

## Undo

Dockable ships no undo/redo (see AGENTS.md rule 12). The transfer event and the two model change
events are what an app builds its own history on. The docs example keeps one history for the group:
undoing a transfer moves the tab back to where it came from in A (and so it disappears from B), with
its content kept, through `group.transfer`.

## React

`Dockable.DragGroup` wraps the roots that exchange tabs. It creates the core group, and renders the
tabs' content in **one place for the whole group**, keyed by tab id: each `Panel` registers its
content (and the context the content needs) instead of portalling it itself. When a tab moves from
root A to root B, A's panel unregisters and B's registers the same key in the same commit, so the
portal and the component state under it are kept. Without a `DragGroup`, panels portal their content
themselves, as before.

## Limits

- Only tabs cross models (not tabsets, tab groups or floats).
- Both roots must be in the same React tree under one `DragGroup`, and in the same page (windows of
  one page count: a model's popouts take part through their main engine).
