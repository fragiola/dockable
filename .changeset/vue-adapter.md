---
"@fragiola/dockable": minor
"@fragiola/dockable-react": minor
"@fragiola/dockable-vue": minor
---

New package: `@fragiola/dockable-vue`, the Dockable primitives for Vue 3.5. Every primitive of the React package is a Vue component under the same `Dockable` namespace, every hook is a composable, and the whole core is re-exported, so a Vue app installs one package. Polymorphism is `as` and a `render` scoped slot, the recursion is scoped slots (`#splitter` replaces `renderSplitter`), `class` and `style` are fallthrough attributes merged under the structural style, and `typedDockable<Types>()` types the parts a template cannot give a type argument.

The core's engine gains adapter keys for the rules every adapter applies to its parts' events, so no adapter re-implements them: `engine.adapter.handleTabKeyDown`, `handleTabClick`, `handleTabSetPointerDown`, `handlePanelPointerDown`, `handlePanelKeyDown`, `handleDocumentKeyDown`, `getKeyShortcuts`, `getKeyMap`, `getDropState` and `isDraggable`, with `keyMap` as an engine setting. The React primitives use them, with no change of behaviour.
